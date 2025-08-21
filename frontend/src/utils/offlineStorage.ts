// Offline storage utility for queuing check-ins when internet is down
interface QueuedCheckin {
  id: string;
  barcode: string;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
}

class OfflineStorage {
  private dbName = 'MASOfflineDB';
  private version = 1;
  private db: IDBDatabase | null = null;
  private isOnline = navigator.onLine;

  constructor() {
    this.initDatabase();
    this.setupOnlineOfflineListeners();
  }

  private async initDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create checkins store
        if (!db.objectStoreNames.contains('checkins')) {
          const checkinsStore = db.createObjectStore('checkins', { keyPath: 'id' });
          checkinsStore.createIndex('timestamp', 'timestamp', { unique: false });
          checkinsStore.createIndex('retryCount', 'retryCount', { unique: false });
        }
      };
    });
  }

  private setupOnlineOfflineListeners(): void {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.syncQueuedCheckins();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  // Check if we're currently online
  public getOnlineStatus(): boolean {
    return this.isOnline;
  }

  // Queue a check-in for later processing
  public async queueCheckin(barcode: string): Promise<string> {
    if (!this.db) await this.initDatabase();
    
    const checkin: QueuedCheckin = {
      id: crypto.randomUUID(),
      barcode,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: 5
    };

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction(['checkins'], 'readwrite');
      const store = transaction.objectStore('checkins');
      const request = store.add(checkin);

      request.onsuccess = () => resolve(checkin.id);
      request.onerror = () => reject(request.error);
    });
  }

  // Get all queued check-ins
  public async getQueuedCheckins(): Promise<QueuedCheckin[]> {
    if (!this.db) await this.initDatabase();
    
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction(['checkins'], 'readonly');
      const store = transaction.objectStore('checkins');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Remove a queued check-in (after successful sync)
  public async removeQueuedCheckin(id: string): Promise<void> {
    if (!this.db) await this.initDatabase();
    
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction(['checkins'], 'readwrite');
      const store = transaction.objectStore('checkins');
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Update retry count for a failed check-in
  public async updateRetryCount(id: string, retryCount: number): Promise<void> {
    if (!this.db) await this.initDatabase();
    
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction(['checkins'], 'readwrite');
      const store = transaction.objectStore('checkins');
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const checkin = getRequest.result;
        if (checkin) {
          checkin.retryCount = retryCount;
          const putRequest = store.put(checkin);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          reject(new Error('Check-in not found'));
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  // Get count of queued check-ins
  public async getQueuedCount(): Promise<number> {
    const checkins = await this.getQueuedCheckins();
    return checkins.length;
  }

  // Clear all queued check-ins (for admin use)
  public async clearAllQueued(): Promise<void> {
    if (!this.db) await this.initDatabase();
    
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction(['checkins'], 'readwrite');
      const store = transaction.objectStore('checkins');
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Attempt to sync all queued check-ins
  public async syncQueuedCheckins(): Promise<{ success: number; failed: number; total: number }> {
    if (!this.isOnline) {
      return { success: 0, failed: 0, total: 0 };
    }

    const checkins = await this.getQueuedCheckins();
    if (checkins.length === 0) {
      return { success: 0, failed: 0, total: 0 };
    }

    let success = 0;
    let failed = 0;

    for (const checkin of checkins) {
      try {
        const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
        const response = await fetch(`${API_URL}/checkin-by-barcode`, {
          method: 'POST',
          headers: { 
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify({ barcode: checkin.barcode }),
        });

        if (response.ok) {
          await this.removeQueuedCheckin(checkin.id);
          success++;
        } else {
          failed++;
          // Increment retry count
          await this.updateRetryCount(checkin.id, checkin.retryCount + 1);
        }
      } catch (error) {
        failed++;
        // Increment retry count
        await this.updateRetryCount(checkin.id, checkin.retryCount + 1);
      }
    }

    return { success, failed, total: checkins.length };
  }

  // Get check-ins that have exceeded max retries
  public async getFailedCheckins(): Promise<QueuedCheckin[]> {
    const checkins = await this.getQueuedCheckins();
    return checkins.filter(checkin => checkin.retryCount >= checkin.maxRetries);
  }
}

// Export singleton instance
export const offlineStorage = new OfflineStorage();

// Export types for use in other components
export type { QueuedCheckin };
