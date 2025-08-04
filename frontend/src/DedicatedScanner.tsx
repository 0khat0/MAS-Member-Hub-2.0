import { useState, useEffect } from 'react';

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

  const handleScannerInput = async (barcode: string) => {
    if (!barcode.trim() || isProcessingScan) return;

    setIsProcessingScan(true);
    setScanMessage("Processing scan...");

    try {
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
      setScanMessage("❌ Network error. Please try again.");
      
      setScanHistory(prev => [{
        timestamp: new Date().toLocaleTimeString(),
        member: 'Network error',
        success: false
      }, ...prev.slice(0, 9)]);
    } finally {
      setIsProcessingScan(false);
      setTimeout(() => setScanMessage(""), 3000);
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
            <div className={`w-4 h-4 rounded-full mx-auto mb-4 ${isProcessingScan ? 'bg-yellow-400 animate-pulse' : 'bg-green-400'}`}></div>
            <h2 className="text-2xl font-semibold text-white mb-2">
              {isProcessingScan ? "Processing..." : "Scanner Ready"}
            </h2>
            <p className="text-white/70">
              {isProcessingScan ? "Please wait..." : "Scan QR codes anytime"}
            </p>
          </div>
        </div>

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
        <div className="mt-8 text-center">
          <a 
            href="/admin" 
            className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            Back to Admin Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}

export default DedicatedScanner; 