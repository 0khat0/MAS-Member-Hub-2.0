import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { getTorontoTime } from './utils';

interface DailyCheckin {
  checkin_id: string;
  email: string;
  name: string;
  timestamp: string;
}

interface Member {
  id: string;
  email: string;
  name: string;
  created_at: string;
}

function AdminDashboard() {
  // Authentication removed - direct admin access
  // Password authentication removed - admin access is now open
  const [stats, setStats] = useState<any>(null);
  const [todayCheckins, setTodayCheckins] = useState<DailyCheckin[]>([]);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");

  // Scanner functionality
  const [scannerInput, setScannerInput] = useState("");
  const [isProcessingScan, setIsProcessingScan] = useState(false);
  const [scanMessage, setScanMessage] = useState("");

  // Authentication check removed - admin access is now open

  useEffect(() => {
    // Fetch today's check-ins
    fetchTodayCheckins();
    fetchStats();
  }, []);

  useEffect(() => {
    fetchTodayCheckins(); // initial fetch
    const interval = setInterval(() => {
      fetchTodayCheckins();
    }, 3500); // every 3.5 seconds
    return () => clearInterval(interval); // cleanup on unmount
  }, []);

  const fetchTodayCheckins = async () => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
      const response = await fetch(`${API_URL}/admin/checkins/today`);
      const data = await response.json();
      setTodayCheckins(data);
    } catch (error) {
      console.error('Error fetching today\'s check-ins:', error);
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/Toronto'
    });
  };



  const fetchStats = async () => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
      const response = await fetch(`${API_URL}/admin/checkins/stats`);
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchMembers = async () => {
    setIsLoadingMembers(true);
    try {
      const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
      const response = await fetch(`${API_URL}/members`);
      const data = await response.json();
      setMembers(data);
    } catch (error) {
      console.error('Error fetching members:', error);
    } finally {
      setIsLoadingMembers(false);
    }
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'MMM d, yyyy');
  };

  // Scanner functions
  const handleScannerInput = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scannerInput.trim()) return;

    setIsProcessingScan(true);
    setScanMessage("Processing scan...");

    try {
      const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
      const barcode = scannerInput.trim();
      
      // Direct check-in by barcode
      const checkinResponse = await fetch(`${API_URL}/checkin-by-barcode`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barcode }),
      });
      
      if (checkinResponse.ok) {
        const result = await checkinResponse.json();
        if (result.family_checkin) {
          setScanMessage(`✅ Family check-in successful! ${result.member_count} members checked in.`);
        } else {
          setScanMessage(`✅ ${result.member_name} checked in successfully!`);
        }
        setScannerInput("");
        fetchTodayCheckins(); // Refresh the check-ins list
      } else {
        const errorData = await checkinResponse.json();
        setScanMessage(`❌ ${errorData.detail || "Check-in failed. Please try again."}`);
      }
    } catch (error) {
      console.error('Scanner error:', error);
      setScanMessage("❌ Network error. Please try again.");
    } finally {
      setIsProcessingScan(false);
      // Clear message after 3 seconds
      setTimeout(() => setScanMessage("") , 3000);
    }
  };

  // Login handler removed - admin access is now open



  // Login form removed - admin access is now open

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 p-4 pb-24">
      <div className="max-w-7xl mx-auto space-y-6">
        <motion.h1 
          className="text-3xl md:text-4xl font-bold text-white mb-8 text-center"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          MAS Academy Member Hub - Admin Dashboard
        </motion.h1>

        {/* Hidden Scanner Input - Invisible Magic Scanner */}
        <div className="fixed top-0 left-0 w-0 h-0 overflow-hidden">
          <input
            type="text"
            value={scannerInput}
            onChange={(e) => {
              setScannerInput(e.target.value);
              // Auto-submit when scanner inputs data (scanner adds Enter key)
              if (e.target.value.trim()) {
                handleScannerInput(e as any);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && scannerInput.trim()) {
                handleScannerInput(e as any);
              }
            }}
            className="opacity-0 absolute -top-100"
            autoFocus
            placeholder=""
          />
        </div>

        {/* Scanner Status Message */}
        {scanMessage && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`fixed top-4 right-4 p-4 rounded-lg text-sm font-medium z-50 ${
              scanMessage.includes("✅") 
                ? "bg-green-500/20 text-green-400 border border-green-500/30"
                : scanMessage.includes("❌")
                ? "bg-red-500/20 text-red-400 border border-red-500/30"
                : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
            }`}
          >
            {scanMessage}
          </motion.div>
        )}

        {/* Debug Timezone Info */}
        <motion.div 
          className="bg-gray-800/50 rounded-xl p-4 backdrop-blur-sm border border-yellow-500/20"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
        >
          <div className="text-center">
            <p className="text-yellow-400 text-sm font-medium mb-2">🌍 Toronto Timezone Debug Info</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-white/70">
              <div>
                <span className="text-white/50">Date:</span> {getTorontoTime().toLocaleDateString('en-US', { timeZone: 'America/Toronto' })}
              </div>
              <div>
                <span className="text-white/50">Day:</span> {getTorontoTime().toLocaleDateString('en-US', { weekday: 'long', timeZone: 'America/Toronto' })}
              </div>
              <div>
                <span className="text-white/50">Time:</span> {getTorontoTime().toLocaleTimeString('en-US', { timeZone: 'America/Toronto' })}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div onClick={() => {
            setShowMembersModal(true);
            fetchMembers();
          }}>
            <StatsCard
              title="Total Members"
              value={stats?.total_members}
              subtitle="All time"
              icon="👥"
              clickable={true}
            />
          </div>
          <StatsCard
            title="Check-ins Today"
            value={stats?.checkins_today}
            subtitle="Today's total"
            icon="📅"
          />
          <StatsCard
            title="Total Check-ins"
            value={stats?.total_checkins}
            subtitle="All time"
            icon="🏆"
          />
        </div>

        {/* Members Modal */}
        <AnimatePresence>
          {showMembersModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setShowMembersModal(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-gray-900 rounded-xl shadow-xl w-full max-w-4xl max-h-[80vh] overflow-hidden"
                onClick={e => e.stopPropagation()}
              >
                <div className="p-6 border-b border-white/10 flex justify-between items-center">
                  <h2 className="text-2xl font-semibold text-white">Member List</h2>
                  <button
                    onClick={() => setShowMembersModal(false)}
                    className="text-white/60 hover:text-white transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="px-6 pt-4 pb-2">
                  <input
                    type="text"
                    placeholder="Search members by name or email..."
                    value={memberSearch}
                    onChange={e => setMemberSearch(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500 mb-4"
                    autoFocus
                  />
                </div>
                <div className="p-6 overflow-auto max-h-[80vh]">
                  {isLoadingMembers ? (
                    <div className="flex justify-center items-center py-12">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div>
                    </div>
                  ) : (
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-white/10">
                          <th className="text-left py-3 px-4 text-white/70 font-medium">Name</th>
                          <th className="text-left py-3 px-4 text-white/70 font-medium">Email</th>
                          <th className="text-left py-3 px-4 text-white/70 font-medium">Joined</th>
                        </tr>
                      </thead>
                      <tbody>
                        {members.filter(m =>
                          m.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
                          m.email.toLowerCase().includes(memberSearch.toLowerCase())
                        ).map((member) => (
                          <tr 
                            key={member.id}
                            className="border-b border-white/5 hover:bg-white/5 transition-colors"
                          >
                            <td className="py-3 px-4 text-white/90 font-medium">{member.name}</td>
                            <td className="py-3 px-4 text-white/90">{member.email}</td>
                            <td className="py-3 px-4 text-white/90">{formatDate(member.created_at)}</td>
                            <td className="py-3 px-4">
                              <button
                                className="bg-red-600 hover:bg-red-700 text-white font-semibold px-3 py-1 rounded text-xs"
                                onClick={async () => {
                                  if (window.confirm('Are you sure you want to permanently delete this member? This cannot be undone.')) {
                                    const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
                                    await fetch(`${API_URL}/member/${member.id}`, { method: 'DELETE' });
                                    await fetchMembers(); // Always await to ensure UI is in sync
                                  }
                                }}
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Today's Check-ins Table */}
        <motion.div 
          className="glass-card p-6 mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <h2 className="text-xl font-semibold text-white mb-6">Today's Check-ins</h2>
          <div className="overflow-x-auto">
            {todayCheckins.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-white/70 text-lg">No check-ins yet today</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 px-4 text-white/70 font-medium">Time</th>
                    <th className="text-left py-3 px-4 text-white/70 font-medium">Name</th>
                    <th className="text-left py-3 px-4 text-white/70 font-medium">Email</th>
                  </tr>
                </thead>
                <tbody>
                  {todayCheckins.map((checkin) => (
                    <tr 
                      key={checkin.checkin_id}
                      className="border-b border-white/5 hover:bg-white/5 transition-colors"
                    >
                      <td className="py-3 px-4 text-white/90">{formatTime(checkin.timestamp)}</td>
                      <td className="py-3 px-4 text-white/90 font-medium">{checkin.name}</td>
                      <td className="py-3 px-4 text-white/90">{checkin.email}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </motion.div>


      </div>
    </div>
  );
}

function StatsCard({ 
  title, 
  value, 
  subtitle, 
  icon,
  clickable = false 
}: { 
  title: string; 
  value?: number; 
  subtitle: string; 
  icon: string;
  clickable?: boolean;
}) {
  return (
    <motion.div
      className={`glass-card p-6 ${clickable ? 'cursor-pointer hover:bg-white/5' : ''}`}
      whileHover={{ scale: clickable ? 1.02 : 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 10 }}
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg text-white/70">{title}</h3>
          <p className="text-3xl font-bold text-white mt-2">{value ?? '...'}</p>
          <p className="text-sm text-white/50 mt-1">{subtitle}</p>
        </div>
        <span className="text-2xl">{icon}</span>
      </div>
    </motion.div>
  );
}

export default AdminDashboard; 