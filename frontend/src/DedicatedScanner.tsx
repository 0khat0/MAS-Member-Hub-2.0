import { useState, useEffect } from 'react';
import { offlineStorage, QueuedCheckin } from './utils/offlineStorage';

interface ScanHistory {
  timestamp: string;
  member: string;
  success: boolean;
}

function DedicatedScanner() {
  const [scannerInput, setScannerInput] = useState("");
  const [isProcessingScan, setIsProcessingScan] = useState(false);
  const [scanMessage, setScanMessage] = useState("");
  const [scanHistory, setScanHistory] = useState<ScanHistory[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queuedCheckins, setQueuedCheckins] = useState<QueuedCheckin[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  // Global keyboard listener for scanner input
  useEffect(() => {
    let currentInput = '';
    let inputTimeout: NodeJS.Timeout;

    const handleKeyPress = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Collect characters from scanner
      if (e.key.length === 1) {
        currentInput += e.key;
        clearTimeout(inputTimeout);
        
        // Set timeout to process input after scanner finishes
        inputTimeout = setTimeout(() => {
          if (currentInput.trim() && !isProcessingScan) {
            console.log('🔍 Dedicated Scanner: Processing barcode:', currentInput);
            handleScannerInput(currentInput);
            currentInput = '';
          }
        }, 150);
      }
      
      // Process on Enter key
      if (e.key === 'Enter' && currentInput.trim() && !isProcessingScan) {
        e.preventDefault();
        console.log('🔍 Dedicated Scanner: Processing barcode on Enter:', currentInput);
        handleScannerInput(currentInput);
        currentInput = '';
      }
    };

    document.addEventListener('keypress', handleKeyPress);
    
    return () => {
      document.removeEventListener('keypress', handleKeyPress);
      clearTimeout(inputTimeout);
    };
  }, [isProcessingScan]);

  // Online/offline status and queued check-ins management
  useEffect(() => {
    const updateOnlineStatus = () => {
      const online = navigator.onLine;
      setIsOnline(online);
      
      if (online) {
        // Try to sync queued check-ins when coming back online
        syncQueuedCheckins();
      }
    };

    const loadQueuedCheckins = async () => {
      try {
        const queued = await offlineStorage.getQueuedCheckins();
        setQueuedCheckins(queued);
      } catch (error) {
        console.error('Failed to load queued check-ins:', error);
      }
    };

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    
    // Load initial queued check-ins
    loadQueuedCheckins();
    
    // Set up periodic refresh of queued check-ins
    const interval = setInterval(loadQueuedCheckins, 5000);
    
    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
      clearInterval(interval);
    };
  }, []);

  // Sync queued check-ins
  const syncQueuedCheckins = async () => {
    if (isSyncing) return;
    
    setIsSyncing(true);
    try {
      const result = await offlineStorage.syncQueuedCheckins();
      if (result.success > 0) {
        setScanMessage(`🔄 Synced ${result.success} queued check-ins!`);
        // Reload queued check-ins
        const queued = await offlineStorage.getQueuedCheckins();
        setQueuedCheckins(queued);
      }
    } catch (error) {
      console.error('Failed to sync queued check-ins:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleScannerInput = async (barcode: string) => {
    if (!barcode.trim() || isProcessingScan) return;

    setIsProcessingScan(true);
    setScanMessage("Processing scan...");

    try {
      // Check if we're online
      if (!isOnline) {
        // Queue the check-in for later
        await offlineStorage.queueCheckin(barcode);
        setScanMessage(`📱 Check-in queued for when internet returns (${await offlineStorage.getQueuedCount()} total queued)`);
        
        // Update queued check-ins list
        const queued = await offlineStorage.getQueuedCheckins();
        setQueuedCheckins(queued);
        
        // Add to scan history
        setScanHistory(prev => [{
          timestamp: new Date().toLocaleTimeString(),
          member: 'Queued for later',
          success: true
        }, ...prev.slice(0, 9)]);
        
        return;
      }

      const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
      const response = await fetch(`${API_URL}/checkin-by-barcode`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({ barcode }),
      });

      if (response.ok) {
        const result = await response.json();
        const memberName = result.family_checkin 
          ? `${result.member_count} family members` 
          : result.member_name || result.member?.name || 'Unknown';
        
        setScanMessage(`✅ ${memberName} checked in successfully!`);
        
        // Add to scan history
        setScanHistory(prev => [{
          timestamp: new Date().toLocaleTimeString(),
          member: memberName,
          success: true
        }, ...prev.slice(0, 9)]); // Keep last 10 scans
        
        // Trigger dashboard update (includes check-ins and stats with delay)
        if ((window as any).refreshAdminDashboard) {
          (window as any).refreshAdminDashboard();
        }
      } else {
        const errorData = await response.json();
        setScanMessage(`❌ ${errorData.detail || 'Check-in failed'}`);
        
        setScanHistory(prev => [{
          timestamp: new Date().toLocaleTimeString(),
          member: 'Failed scan',
          success: false
        }, ...prev.slice(0, 9)]);
      }
    } catch (error) {
      console.error('Scanner error:', error);
      
      // If it's a network error and we're offline, queue the check-in
      if (!isOnline) {
        try {
          await offlineStorage.queueCheckin(barcode);
          setScanMessage(`📱 Check-in queued for when internet returns (${await offlineStorage.getQueuedCount()} total queued)`);
          
          // Update queued check-ins list
          const queued = await offlineStorage.getQueuedCheckins();
          setQueuedCheckins(queued);
          
          // Add to scan history
          setScanHistory(prev => [{
            timestamp: new Date().toLocaleTimeString(),
            member: 'Queued for later',
            success: true
        }, ...prev.slice(0, 9)]);
        } catch (queueError) {
          setScanMessage("❌ Failed to queue check-in. Please try again when online.");
          setScanHistory(prev => [{
            timestamp: new Date().toLocaleTimeString(),
            member: 'Queue failed',
            success: false
          }, ...prev.slice(0, 9)]);
        }
      } else {
        setScanMessage("❌ Network error. Please try again.");
        setScanHistory(prev => [{
          timestamp: new Date().toLocaleTimeString(),
          member: 'Network error',
          success: false
        }, ...prev.slice(0, 9)]);
      }
    } finally {
      setIsProcessingScan(false);
      setTimeout(() => setScanMessage(""), 5000); // Longer timeout for offline messages
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">🔍 QR Code Scanner</h1>
          <p className="text-white/70">Always listening for QR codes</p>
        </div>

        {/* Scanner Status */}
        <div className="bg-gray-800/50 rounded-xl p-6 mb-8 backdrop-blur-sm border border-green-500/20">
          <div className="text-center">
            <div className={`w-4 h-4 rounded-full mx-auto mb-4 ${isProcessingScan ? 'bg-yellow-400 animate-pulse' : isOnline ? 'bg-green-400' : 'bg-red-400'}`}></div>
            <h2 className="text-2xl font-semibold text-white mb-2">
              {isProcessingScan ? "Processing..." : isOnline ? "Scanner Ready" : "Scanner Offline"}
            </h2>
            <p className="text-white/70">
              {isProcessingScan ? "Please wait..." : isOnline ? "Scan QR codes anytime" : "Check-ins will be queued until internet returns"}
            </p>
            {!isOnline && (
              <div className="mt-3 p-2 bg-red-500/20 border border-red-500/30 rounded-lg">
                <p className="text-red-400 text-sm">📱 Offline Mode - Check-ins will be queued</p>
              </div>
            )}
          </div>
        </div>

        {/* Queued Check-ins Status */}
        {queuedCheckins.length > 0 && (
          <div className="bg-blue-900/20 rounded-xl p-6 mb-8 backdrop-blur-sm border border-blue-500/30">
            <div className="text-center mb-4">
              <h3 className="text-xl font-semibold text-blue-400 mb-2">📱 Queued Check-ins</h3>
              <p className="text-blue-300/80">These check-ins are waiting to be synced when internet returns</p>
            </div>
            
            <div className="space-y-2 mb-4">
              {queuedCheckins.slice(0, 5).map((checkin) => (
                <div key={checkin.id} className="flex justify-between items-center p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                  <span className="text-blue-300 font-mono">{checkin.barcode}</span>
                  <span className="text-blue-300/70 text-sm">
                    {new Date(checkin.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
              {queuedCheckins.length > 5 && (
                <p className="text-blue-300/70 text-sm text-center">
                  ...and {queuedCheckins.length - 5} more
                </p>
              )}
            </div>
            
            <div className="flex justify-center space-x-3">
              <button
                onClick={syncQueuedCheckins}
                disabled={isSyncing || !isOnline}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
              >
                {isSyncing ? "🔄 Syncing..." : "🔄 Sync Now"}
              </button>
              <button
                onClick={() => offlineStorage.clearAllQueued().then(() => {
                  setQueuedCheckins([]);
                  setScanMessage("🗑️ All queued check-ins cleared");
                })}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
              >
                🗑️ Clear All
              </button>
            </div>
          </div>
        )}

        {/* Current Scan Message */}
        {scanMessage && (
          <div className={`mb-8 p-4 rounded-lg text-center text-lg font-medium ${
            scanMessage.includes("✅") 
              ? "bg-green-500/20 text-green-400 border border-green-500/30"
              : "bg-red-500/20 text-red-400 border border-red-500/30"
          }`}>
            {scanMessage}
          </div>
        )}

        {/* Scan History */}
        <div className="bg-gray-800/50 rounded-xl p-6 backdrop-blur-sm border border-white/10">
          <h3 className="text-xl font-semibold text-white mb-4">Recent Scans</h3>
          {scanHistory.length === 0 ? (
            <p className="text-white/50 text-center py-8">No scans yet</p>
          ) : (
            <div className="space-y-2">
              {scanHistory.map((scan, index) => (
                <div key={index} className={`flex justify-between items-center p-3 rounded-lg ${
                  scan.success ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'
                }`}>
                  <span className="text-white font-medium">{scan.member}</span>
                  <span className="text-white/70 text-sm">{scan.timestamp}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="mt-8 text-center space-y-3">
          {queuedCheckins.length > 0 && isOnline && (
            <div>
              <button
                onClick={syncQueuedCheckins}
                disabled={isSyncing}
                className="inline-block px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-green-600/50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors mr-3"
              >
                {isSyncing ? "🔄 Syncing..." : "🔄 Sync Queued Check-ins"}
              </button>
            </div>
          )}
          <div>
            <a 
              href="/admin" 
              className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Back to Admin Dashboard
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DedicatedScanner; 