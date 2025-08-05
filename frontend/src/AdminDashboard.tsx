import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { getEasternTime } from './utils';

interface DailyCheckin {
  checkin_id: string;
  email: string;
  name: string;
  timestamp: string;
  is_family?: boolean;
  family_members?: Array<{
    checkin_id: string;
    name: string;
    email: string;
    timestamp: string;
  }>;
  member_count?: number;
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

  // Member editing functionality
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [isUpdatingMember, setIsUpdatingMember] = useState(false);

  // Family check-in expansion state
  const [expandedFamilies, setExpandedFamilies] = useState<Set<string>>(new Set());
  const [selectedFamilyMembers, setSelectedFamilyMembers] = useState<Record<string, Set<string>>>({});



  // Authentication check removed - admin access is now open

  useEffect(() => {
    // Fetch today's check-ins
    fetchTodayCheckins();
    fetchStats();
    
    // Expose refresh functions globally for external access
    (window as any).refreshAdminStats = fetchStats;
    (window as any).refreshAdminCheckins = fetchTodayCheckins;
    
    // Set up periodic stats refresh
    const statsInterval = setInterval(() => {
      fetchStats();
    }, 10000); // every 10 seconds
    
    return () => {
      delete (window as any).refreshAdminStats;
      delete (window as any).refreshAdminCheckins;
      clearInterval(statsInterval);
    };
  }, []);

  useEffect(() => {
    fetchTodayCheckins(); // initial fetch
    const interval = setInterval(() => {
      fetchTodayCheckins();
    }, 3000); // every 3 seconds for more responsive updates
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

  // Member management functions
  const handleEditMember = (member: Member) => {
    setEditingMember(member);
    setEditName(member.name);
    setEditEmail(member.email);
  };

  const handleUpdateMember = async () => {
    if (!editingMember || !editName.trim() || !editEmail.trim()) return;

    setIsUpdatingMember(true);
    try {
      const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
      const response = await fetch(`${API_URL}/member/${editingMember.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: editName.trim(),
          email: editEmail.trim(),
        }),
      });

      if (response.ok) {
        // Update the member in the local state
        setMembers(prevMembers => 
          prevMembers.map(member => 
            member.id === editingMember.id 
              ? { ...member, name: editName.trim(), email: editEmail.trim() }
              : member
          )
        );
        setEditingMember(null);
        setEditName("");
        setEditEmail("");
      } else {
        const errorData = await response.json();
        alert(`Failed to update member: ${errorData.detail || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error updating member:', error);
      alert('Failed to update member. Please try again.');
    } finally {
      setIsUpdatingMember(false);
    }
  };

  const handleDeleteMember = async (member: Member) => {
    if (!window.confirm(`Are you sure you want to permanently delete ${member.name}? This action cannot be undone.`)) {
      return;
    }

    try {
      const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
      const response = await fetch(`${API_URL}/member/${member.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Remove the member from local state
        setMembers(prevMembers => prevMembers.filter(m => m.id !== member.id));
        // Refresh stats to update member count
        fetchStats();
      } else {
        const errorData = await response.json();
        alert(`Failed to delete member: ${errorData.detail || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error deleting member:', error);
      alert('Failed to delete member. Please try again.');
    }
  };

  const cancelEdit = () => {
    setEditingMember(null);
    setEditName("");
    setEditEmail("");
  };

  const toggleFamilyExpansion = (checkinId: string) => {
    setExpandedFamilies(prev => {
      const newSet = new Set(prev);
      if (newSet.has(checkinId)) {
        newSet.delete(checkinId);
      } else {
        newSet.add(checkinId);
      }
      return newSet;
    });
  };

  const toggleFamilyMemberSelection = (checkinId: string, memberCheckinId: string) => {
    setSelectedFamilyMembers(prev => {
      const newState = { ...prev };
      if (!newState[checkinId]) {
        newState[checkinId] = new Set();
      }
      
      const memberSet = new Set(newState[checkinId]);
      if (memberSet.has(memberCheckinId)) {
        memberSet.delete(memberCheckinId);
      } else {
        memberSet.add(memberCheckinId);
      }
      
      newState[checkinId] = memberSet;
      return newState;
    });
  };

  const isFamilyMemberSelected = (checkinId: string, memberCheckinId: string) => {
    return selectedFamilyMembers[checkinId]?.has(memberCheckinId) || false;
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

        {/* Scanner Navigation */}
        <motion.div 
          className="text-center mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <a 
            href="/admin/scanner" 
            className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
          >
            <span>🔍</span>
            <span>Open QR Scanner</span>
          </a>
        </motion.div>

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
                  <span className="text-white/50">Date:</span> {getEasternTime().toLocaleDateString('en-US', { timeZone: 'America/Toronto' })}
                </div>
                <div>
                  <span className="text-white/50">Day:</span> {getEasternTime().toLocaleDateString('en-US', { weekday: 'long', timeZone: 'America/Toronto' })}
                </div>
                <div>
                  <span className="text-white/50">Time:</span> {getEasternTime().toLocaleTimeString('en-US', { timeZone: 'America/Toronto' })}
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
                className="bg-gray-900 rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col"
                onClick={e => e.stopPropagation()}
              >
                <div className="p-6 border-b border-white/10 flex justify-between items-center flex-shrink-0">
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
                <div className="px-6 pt-4 pb-2 flex-shrink-0">
                  <input
                    type="text"
                    placeholder="Search members by name or email..."
                    value={memberSearch}
                    onChange={e => setMemberSearch(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500 mb-4"
                    autoFocus
                  />
                </div>
                <div className="flex-1 overflow-y-auto p-6">
                  {isLoadingMembers ? (
                    <div className="flex justify-center items-center py-12">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div>
                    </div>
                  ) : (
                    <div className="min-h-0 flex-1">
                      <table className="w-full">
                        <thead className="sticky top-0 bg-gray-900 z-10">
                          <tr className="border-b border-white/10">
                            <th className="text-left py-3 px-4 text-white/70 font-medium">Name</th>
                            <th className="text-left py-3 px-4 text-white/70 font-medium">Email</th>
                            <th className="text-left py-3 px-4 text-white/70 font-medium">Joined</th>
                            <th className="text-left py-3 px-4 text-white/70 font-medium">Actions</th>
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
                              <td className="py-3 px-4 text-white/90 font-medium">
                                {editingMember?.id === member.id ? (
                                  <input
                                    type="text"
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    className="bg-gray-800 text-white px-2 py-1 rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    disabled={isUpdatingMember}
                                  />
                                ) : (
                                  member.name
                                )}
                              </td>
                              <td className="py-3 px-4 text-white/90">
                                {editingMember?.id === member.id ? (
                                  <input
                                    type="email"
                                    value={editEmail}
                                    onChange={(e) => setEditEmail(e.target.value)}
                                    className="bg-gray-800 text-white px-2 py-1 rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    disabled={isUpdatingMember}
                                  />
                                ) : (
                                  <a 
                                    href={`mailto:${member.email}`}
                                    className="text-blue-400 hover:underline"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {member.email}
                                  </a>
                                )}
                              </td>
                              <td className="py-3 px-4 text-white/90">{formatDate(member.created_at)}</td>
                              <td className="py-3 px-4">
                                {editingMember?.id === member.id ? (
                                  <div className="flex gap-2">
                                    <button
                                      className="bg-green-600 hover:bg-green-700 text-white font-semibold px-3 py-1 rounded text-xs"
                                      onClick={handleUpdateMember}
                                      disabled={isUpdatingMember}
                                    >
                                      {isUpdatingMember ? "Saving..." : "Save"}
                                    </button>
                                    <button
                                      className="bg-gray-600 hover:bg-gray-700 text-white font-semibold px-3 py-1 rounded text-xs"
                                      onClick={cancelEdit}
                                      disabled={isUpdatingMember}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex gap-2">
                                    <button
                                      className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-3 py-1 rounded text-xs"
                                      onClick={() => handleEditMember(member)}
                                    >
                                      Edit
                                    </button>
                                    <button
                                      className="bg-red-600 hover:bg-red-700 text-white font-semibold px-3 py-1 rounded text-xs"
                                      onClick={() => handleDeleteMember(member)}
                                    >
                                      Delete
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
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
                <p className="text-white/70 text-lg">No home page visits yet today</p>
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
                    <>
                      <tr 
                        key={checkin.checkin_id}
                        className={`border-b border-white/5 transition-colors ${
                          checkin.is_family 
                            ? 'bg-purple-900/20 hover:bg-purple-900/30 border-purple-500/30' 
                            : 'hover:bg-white/5'
                        }`}
                      >
                        <td className="py-3 px-4 text-white/90">{formatTime(checkin.timestamp)}</td>
                        <td className="py-3 px-4 text-white/90 font-medium">
                          <div className="flex items-center gap-2">
                            {checkin.is_family && (
                              <span className="text-purple-400 text-sm">👨‍👩‍👧‍👦</span>
                            )}
                            {checkin.name}
                            {checkin.is_family && (
                              <>
                                <button
                                  onClick={() => toggleFamilyExpansion(checkin.checkin_id)}
                                  className="ml-2 text-purple-400 hover:text-purple-300 transition-colors"
                                  title="View family members"
                                >
                                  <svg 
                                    className={`w-4 h-4 transition-transform ${expandedFamilies.has(checkin.checkin_id) ? 'rotate-180' : ''}`} 
                                    fill="none" 
                                    stroke="currentColor" 
                                    viewBox="0 0 24 24"
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  </svg>
                                </button>
                                {selectedFamilyMembers[checkin.checkin_id] && selectedFamilyMembers[checkin.checkin_id].size > 0 && (
                                  <span className="ml-2 text-xs bg-purple-600 text-white px-2 py-1 rounded-full">
                                    {selectedFamilyMembers[checkin.checkin_id].size} selected
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-white/90">
                          <a 
                            href={`mailto:${checkin.email}`}
                            className="text-blue-400 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {checkin.email}
                          </a>
                        </td>
                      </tr>
                      {checkin.is_family && expandedFamilies.has(checkin.checkin_id) && checkin.family_members && (
                        checkin.family_members.map((member) => (
                          <tr 
                            key={member.checkin_id}
                            className="border-b border-white/5 bg-purple-900/10 hover:bg-purple-900/20 transition-colors"
                          >
                            <td className="py-2 px-4 text-white/70 text-sm pl-8">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                                {formatTime(member.timestamp)}
                              </div>
                            </td>
                            <td className="py-2 px-4 text-white/70 text-sm font-medium pl-8">
                              <div className="flex items-center gap-3">
                                <input
                                  type="checkbox"
                                  checked={isFamilyMemberSelected(checkin.checkin_id, member.checkin_id)}
                                  onChange={() => toggleFamilyMemberSelection(checkin.checkin_id, member.checkin_id)}
                                  className="w-4 h-4 text-purple-600 bg-gray-700 border-gray-600 rounded focus:ring-purple-500 focus:ring-2"
                                />
                                {member.name}
                              </div>
                            </td>
                            <td className="py-2 px-4 text-white/70 text-sm pl-8">
                              <a 
                                href={`mailto:${member.email}`}
                                className="text-blue-400 hover:underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {member.email}
                              </a>
                            </td>
                          </tr>
                        ))
                      )}
                    </>
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