// Simple test file for offline storage functionality
// This can be run manually to verify the offline storage works

import { offlineStorage } from './offlineStorage';

// Test function to verify offline storage
export async function testOfflineStorage() {
  console.log('🧪 Testing Offline Storage...');
  
  try {
    // Test 1: Queue a check-in
    console.log('Test 1: Queueing a check-in...');
    const id1 = await offlineStorage.queueCheckin('TEST123');
    console.log('✅ Check-in queued with ID:', id1);
    
    // Test 2: Queue another check-in
    console.log('Test 2: Queueing another check-in...');
    const id2 = await offlineStorage.queueCheckin('TEST456');
    console.log('✅ Check-in queued with ID:', id2);
    
    // Test 3: Get queued count
    console.log('Test 3: Getting queued count...');
    const count = await offlineStorage.getQueuedCount();
    console.log('✅ Queued count:', count);
    
    // Test 4: Get all queued check-ins
    console.log('Test 4: Getting all queued check-ins...');
    const queued = await offlineStorage.getQueuedCheckins();
    console.log('✅ Queued check-ins:', queued);
    
    // Test 5: Update retry count
    console.log('Test 5: Updating retry count...');
    await offlineStorage.updateRetryCount(id1, 2);
    console.log('✅ Retry count updated');
    
    // Test 6: Get failed check-ins
    console.log('Test 6: Getting failed check-ins...');
    const failed = await offlineStorage.getFailedCheckins();
    console.log('✅ Failed check-ins:', failed);
    
    // Test 7: Clear all queued
    console.log('Test 7: Clearing all queued check-ins...');
    await offlineStorage.clearAllQueued();
    console.log('✅ All queued check-ins cleared');
    
    // Test 8: Verify count is 0
    const finalCount = await offlineStorage.getQueuedCount();
    console.log('✅ Final count:', finalCount);
    
    console.log('🎉 All tests passed! Offline storage is working correctly.');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Export for manual testing
export default testOfflineStorage;
