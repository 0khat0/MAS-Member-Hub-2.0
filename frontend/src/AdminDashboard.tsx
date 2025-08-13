import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { isValidAccountCode } from './utils';

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
    member_id: string;
  }>;
  member_count?: number;
}

interface Member {
  id: string;
  email: string;
  name: string;
  created_at: string;
  household_code?: string;
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

  // Manual check-in functionality
  const [manualAccountCode, setManualAccountCode] = useState("");
  const [manualHousehold, setManualHousehold] = useState<any>(null);
  const [isLoadingManual, setIsLoadingManual] = useState(false);
  const [manualError, setManualError] = useState("");
  const [manualSuccess, setManualSuccess] = useState("");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [lastLookupTime, setLastLookupTime] = useState<Date | null>(null);

  // Loading states
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Refs for outside click detection
  const tableRef = useRef<HTMLDivElement>(null);

  // Define functions before useEffect
  const fetchTodayCheckins = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
      const response = await fetch(`${API_URL}/admin/checkins/today`);
      
      if (!response.ok) {
        if (response.status === 429) {
          console.warn('Rate limited. Please wait before refreshing again.');
          setTodayCheckins([]);
          return;
        }
        console.error('Error response:', response.status, response.statusText);
        setTodayCheckins([]);
        return;
      }
      
      const data = await response.json();
      
      // Validate that data is an array
      if (!Array.isArray(data)) {
        console.error('Invalid data format received:', data);
        setTodayCheckins([]);
        return;
      }
      
      setTodayCheckins(data);
      
      // Initialize selected family members based on existing check-ins
      const initialSelectedState: Record<string, Set<string>> = {};
      data.forEach((checkin: DailyCheckin) => {
        if (checkin.is_family && checkin.family_members) {
          const selectedMembers = new Set<string>();
          checkin.family_members.forEach(member => {
            selectedMembers.add(member.checkin_id);
          });
          initialSelectedState[checkin.checkin_id] = selectedMembers;
        }
      });
      setSelectedFamilyMembers(initialSelectedState);
      
      // Preserve expanded families state
      setExpandedFamilies(prev => {
        if (prev.size === 0) {
          return new Set();
        }
        return prev;
      });
    } catch (error) {
      console.error('Error fetching today\'s check-ins:', error);
      setTodayCheckins([]);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const formatTime = (timestamp: string) => {
    try {
      // Clean up malformed timestamp: remove 'Z' if there's already a timezone offset
      let cleanTimestamp = timestamp;
      if (timestamp.includes('+') && timestamp.endsWith('Z')) {
        cleanTimestamp = timestamp.slice(0, -1); // Remove the trailing 'Z'
      }
      
      const date = new Date(cleanTimestamp);
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        console.warn('Invalid timestamp received:', timestamp);
        return 'Invalid Time';
      }
      
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'America/Toronto'
      });
    } catch (error) {
      console.error('Error formatting timestamp:', timestamp, error);
      return 'Error';
    }
  };
  


  const fetchStats = async (retryCount = 0) => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
      const response = await fetch(`${API_URL}/admin/checkins/stats`);
      
      if (!response.ok) {
        if (response.status === 429) {
          console.warn('Rate limited. Please wait before refreshing stats.');
          // Retry after delay if we haven't exceeded max retries
          if (retryCount < 2) {
            setTimeout(() => fetchStats(retryCount + 1), 3000 + (retryCount * 2000));
          }
          return;
        }
        console.error('Error fetching stats:', response.status, response.statusText);
        return;
      }
      
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
      // Retry on network errors if we haven't exceeded max retries
      if (retryCount < 2) {
        setTimeout(() => fetchStats(retryCount + 1), 3000 + (retryCount * 2000));
      }
    }
  };

  const fetchMembers = async () => {
    setIsLoadingMembers(true);
    try {
      const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
      const response = await fetch(`${API_URL}/members`);
      
      if (!response.ok) {
        if (response.status === 429) {
          console.warn('Rate limited. Please wait before refreshing members.');
          setMembers([]);
          return;
        }
        console.error('Error fetching members:', response.status, response.statusText);
        setMembers([]);
        return;
      }
      
      const data = await response.json();
      if (Array.isArray(data)) {
        setMembers(data);
      } else {
        console.error('Invalid members data format:', data);
        setMembers([]);
      }
    } catch (error) {
      console.error('Error fetching members:', error);
      setMembers([]);
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

  // Manual check-in functions
  const handleManualLookup = async () => {
    if (!manualAccountCode.trim()) {
      setManualError("Please enter an account code");
      return;
    }

    setIsLoadingManual(true);
    setManualError("");
    setManualSuccess("");
    setManualHousehold(null);

    try {
      const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
      const response = await fetch(`${API_URL}/admin/household/${manualAccountCode.trim()}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          setManualError("Account not found");
        } else {
          const errorData = await response.json();
          setManualError(errorData.detail || "Failed to lookup account");
        }
        return;
      }
      
      const data = await response.json();
      setManualHousehold(data);
      setManualSuccess(`Found account ${data.household_code} with ${data.member_count} members`);
      setLastLookupTime(new Date());
    } catch (error) {
      console.error('Error looking up account:', error);
      setManualError("Failed to lookup account. Please try again.");
    } finally {
      setIsLoadingManual(false);
    }
  };

  const handleManualCheckin = async (memberId: string, memberName: string) => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
      const response = await fetch(`${API_URL}/admin/checkin/member`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          member_id: memberId,
          timestamp: new Date().toISOString()
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.already_checked_in) {
          setManualSuccess(`${memberName} is already checked in today`);
        } else {
          setManualError(`Failed to check in ${memberName}: ${errorData.detail || 'Unknown error'}`);
        }
        return;
      }
      
      const result = await response.json();
      setManualSuccess(`${memberName} checked in successfully!`);
      
      // Refresh the household data to show updated check-in status
      if (manualHousehold) {
        handleManualLookup();
      }
      
      // Also refresh today's check-ins
      fetchTodayCheckins();
    } catch (error) {
      console.error('Error checking in member:', error);
      setManualError(`Failed to check in ${memberName}. Please try again.`);
    }
  };

  const clearManualCheckin = () => {
    setManualAccountCode("");
    setManualHousehold(null);
    setManualError("");
    setManualSuccess("");
    setLastLookupTime(null);
  };

  const toggleFamilyExpansion = (checkinId: string) => {
    console.log('Toggle clicked for:', checkinId);
    console.log('Current expanded families:', Array.from(expandedFamilies));
    setExpandedFamilies(prev => {
      const newSet = new Set(prev);
      if (newSet.has(checkinId)) {
        newSet.delete(checkinId);
        console.log('Removing from expanded');
      } else {
        newSet.add(checkinId);
        console.log('Adding to expanded');
      }
      console.log('New expanded families:', Array.from(newSet));
      return newSet;
    });
  };

  const toggleFamilyMemberSelection = async (checkinId: string, memberCheckinId: string, memberId: string, memberName: string, timestamp: string) => {
    const isCurrentlySelected = selectedFamilyMembers[checkinId]?.has(memberCheckinId);
    
    // Preserve expanded state during the operation
    const currentExpandedState = new Set(expandedFamilies);
    
    try {
      const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
      
      if (isCurrentlySelected && memberCheckinId) {
        // Remove check-in (only if there's an actual check-in to remove)
        const response = await fetch(`${API_URL}/admin/checkin/${memberCheckinId}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (response.ok) {
          // Update local state
          setSelectedFamilyMembers(prev => {
            const newState = { ...prev };
            if (newState[checkinId]) {
              const memberSet = new Set(newState[checkinId]);
              memberSet.delete(memberCheckinId);
              newState[checkinId] = memberSet;
            }
            return newState;
          });
          
          // Update today's check-ins data locally instead of refetching
          setTodayCheckins(prev => {
            return prev.map(checkin => {
              if (checkin.checkin_id === checkinId && checkin.family_members) {
                return {
                  ...checkin,
                  family_members: checkin.family_members.filter(member => member.checkin_id !== memberCheckinId),
                  member_count: checkin.family_members.filter(member => member.checkin_id !== memberCheckinId).length
                };
              }
              return checkin;
            });
          });
        } else {
          console.error('Failed to remove check-in');
        }
      } else {
        // Add check-in
        const response = await fetch(`${API_URL}/admin/checkin/member`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            member_id: memberId,
            timestamp: timestamp
          }),
        });
        
        if (response.ok) {
          const result = await response.json();
          
          // Update local state with new check-in ID
          setSelectedFamilyMembers(prev => {
            const newState = { ...prev };
            if (!newState[checkinId]) {
              newState[checkinId] = new Set();
            }
            const memberSet = new Set(newState[checkinId]);
            memberSet.add(result.checkin_id);
            newState[checkinId] = memberSet;
            return newState;
          });
          
          // Update today's check-ins data locally instead of refetching
          setTodayCheckins(prev => {
            return prev.map(checkin => {
              if (checkin.checkin_id === checkinId) {
                const newMember = {
                  checkin_id: result.checkin_id,
                  name: memberName,
                  email: checkin.email,
                  timestamp: result.timestamp,
                  member_id: memberId
                };
                return {
                  ...checkin,
                  family_members: [...(checkin.family_members || []), newMember],
                  member_count: (checkin.family_members?.length || 0) + 1
                };
              }
              return checkin;
            });
          });
        } else {
          console.error('Failed to add check-in');
        }
      }
    } catch (error) {
      console.error('Error toggling member selection:', error);
    } finally {
      // Restore expanded state to prevent dropdown from closing
      setExpandedFamilies(currentExpandedState);
    }
  };

  const isFamilyMemberSelected = (checkinId: string, memberCheckinId: string) => {
    // Check if this member's check-in ID is in the selected set
    return selectedFamilyMembers[checkinId]?.has(memberCheckinId) || false;
  };

  const getSelectedCount = (checkinId: string) => {
    return selectedFamilyMembers[checkinId]?.size || 0;
  };



  // Authentication check removed - admin access is now open

  useEffect(() => {
    // Initial fetch with longer delays to prevent rate limiting
    const loadData = async () => {
      await fetchTodayCheckins();
      await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
      await fetchStats();
      await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
      await fetchMembers();
    };
    
    loadData();
    
    // Expose refresh functions globally for external access
    (window as any).refreshAdminStats = fetchStats;
    (window as any).refreshAdminCheckins = fetchTodayCheckins;
    (window as any).refreshAdminDashboard = async () => {
      await fetchTodayCheckins();
      await new Promise(resolve => setTimeout(resolve, 500));
      await fetchStats();
      await new Promise(resolve => setTimeout(resolve, 500));
      await fetchMembers(); // Also refresh members list to include new family members
    };
    
    // Auto-refresh check-ins every 2 seconds for near real-time updates
    const refreshInterval = setInterval(async () => {
      try {
        await fetchTodayCheckins();
      } catch (error) {
        console.warn('Auto-refresh failed:', error);
      }
    }, 2000); // 2 seconds
    
    // Update current time every minute
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // 1 minute
    
    return () => {
      clearInterval(refreshInterval);
      clearInterval(timeInterval);
      delete (window as any).refreshAdminStats;
      delete (window as any).refreshAdminCheckins;
      delete (window as any).refreshAdminDashboard;
    };
  }, []);

  // Handle outside click and escape key to close expanded families
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tableRef.current && !tableRef.current.contains(event.target as Node)) {
        // Clicked outside the table - close all expanded families
        setExpandedFamilies(new Set());
      }
    };

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // Escape key pressed - close all expanded families
        setExpandedFamilies(new Set());
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscapeKey);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 p-4 pb-24">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Admin Dashboard</h1>
            <p className="text-white/60">Manage members and monitor check-ins</p>
          </div>

        </div>

        {/* Manual Check-in Section */}
        <motion.div 
          className="bg-gray-900 border border-gray-700 rounded-xl p-6 mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-white">Manual Check-in</h2>
          </div>
          
          <div className="space-y-4">
            {/* Account Code Input */}
            <div className="flex gap-3">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Enter Account Code (e.g., ABC123)"
                  value={manualAccountCode}
                  onChange={(e) => setManualAccountCode(e.target.value.toUpperCase())}
                  className={`w-full px-4 py-2 rounded-lg bg-gray-800 text-white border focus:outline-none focus:ring-2 font-mono text-lg tracking-wider ${
                    manualAccountCode && !isValidAccountCode(manualAccountCode)
                      ? 'border-red-500 focus:ring-red-500'
                      : 'border-gray-700 focus:ring-blue-500'
                  }`}
                  maxLength={6}
                  onKeyPress={(e) => e.key === 'Enter' && handleManualLookup()}
                />
                {manualAccountCode && !isValidAccountCode(manualAccountCode) && (
                  <div className="text-red-400 text-xs mt-1">
                    Account code must be 6 characters (letters and numbers only)
                  </div>
                )}
              </div>
              <button
                onClick={handleManualLookup}
                disabled={isLoadingManual || !manualAccountCode.trim() || !isValidAccountCode(manualAccountCode.trim())}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
              >
                {isLoadingManual ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  'Lookup'
                )}
              </button>
              {manualHousehold && (
                <button
                  onClick={clearManualCheckin}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Error/Success Messages */}
            {manualError && (
              <div className="text-red-400 text-sm bg-red-900/20 border border-red-700 rounded-lg px-3 py-2">
                {manualError}
              </div>
            )}
            {manualSuccess && (
              <div className="text-green-400 text-sm bg-green-900/20 border border-green-700 rounded-lg px-3 py-2">
                {manualSuccess}
              </div>
            )}

            {/* Household Members Display */}
            {manualHousehold && (
              <div className="bg-gray-800 border border-gray-600 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-semibold text-white">
                      Account #{manualHousehold.household_code}
                    </h3>
                    <p className="text-gray-400 text-sm">{manualHousehold.owner_email}</p>
                    {lastLookupTime && (
                      <p className="text-gray-500 text-xs mt-1">
                        Looked up at {lastLookupTime.toLocaleTimeString()}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-blue-400">{manualHousehold.member_count}</div>
                    <div className="text-gray-400 text-sm">Members</div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  {manualHousehold.members.map((member: any) => (
                    <div 
                      key={member.id}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        member.already_checked_in 
                          ? 'bg-green-900/20 border-green-600' 
                          : 'bg-gray-700/50 border-gray-600'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${
                          member.already_checked_in ? 'bg-green-500' : 'bg-gray-500'
                        }`}></div>
                        <div>
                          <div className="text-white font-medium">{member.name}</div>
                          <div className="text-gray-400 text-sm">{member.email}</div>
                          {member.already_checked_in && (
                            <div className="text-green-400 text-xs">
                              Checked in at {new Date(member.checkin_time).toLocaleTimeString()}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <button
                        onClick={() => handleManualCheckin(member.id, member.name)}
                        disabled={member.already_checked_in}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                          member.already_checked_in
                            ? 'bg-green-700 text-green-200 cursor-not-allowed'
                            : 'bg-blue-600 hover:bg-blue-700 text-white'
                        }`}
                      >
                        {member.already_checked_in ? 'Checked In' : `Check In (${currentTime.toLocaleTimeString()})`}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>

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
                              icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                }
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
                <div className="flex-1 overflow-y-auto">
                  {isLoadingMembers ? (
                    <div className="flex justify-center items-center py-12">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div>
                    </div>
                  ) : (
                    <div className="min-h-0 flex-1">
                      <table className="w-full">
                        <thead className="sticky top-0 bg-gray-900 z-10 shadow-sm">
                          <tr className="border-b border-white/10">
                            <th className="text-left py-3 px-10 text-white/70 font-medium">Name</th>
                            <th className="text-left py-3 px-4 text-white/70 font-medium">Email</th>
                            <th className="text-left py-3 px-4 text-white/70 font-medium">Account #</th>
                            <th className="text-left py-3 px-4 text-white/70 font-medium">Joined</th>
                            <th className="text-left py-3 px-10 text-white/70 font-medium">Actions</th>
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
                              <td className="py-3 px-10 text-white/90 font-medium">
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
                              <td className="py-3 px-4 text-white/90">{member.household_code || 'N/A'}</td>
                              <td className="py-3 px-4 text-white/90">{formatDate(member.created_at)}</td>
                              <td className="py-3 px-10">
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
          <div className="flex items-center gap-3 mb-6">
            <h2 className="text-xl font-semibold text-white">Today's Check-ins</h2>
            <div className="text-white/50 text-xs flex items-center gap-1">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              Live
            </div>
          </div>
          <div className="overflow-x-auto" ref={tableRef}>
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
                  {Array.isArray(todayCheckins) ? todayCheckins.map((checkin, index) => (
                    <React.Fragment key={`fragment-${checkin.checkin_id}-${index}`}>
                      <tr 
                        key={`${checkin.checkin_id}-${index}`}
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
                              <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a4 4 0 11-8 0 4 4 0 018 0z" />
                            </svg>
                            )}
                            {checkin.name}
                            {checkin.is_family && (
                              <>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleFamilyExpansion(checkin.checkin_id);
                                  }}
                                  className="ml-2 p-1 text-purple-400 hover:text-purple-300 hover:bg-purple-900/20 rounded transition-colors"
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
                      {checkin.is_family && expandedFamilies.has(checkin.checkin_id) && (
                        // Get all family members for this email
                        (() => {
                          const familyMembers = members.filter(m => m.email === checkin.email);
                          return familyMembers.map((member) => {
                            // Find if this member has a check-in in today's data
                            const memberCheckin = checkin.family_members?.find(m => m.member_id === member.id);
                            const isCheckedIn = memberCheckin ? isFamilyMemberSelected(checkin.checkin_id, memberCheckin.checkin_id) : false;
                            
                            return (
                              <tr 
                                key={`family-member-${checkin.checkin_id}-${member.id}`}
                                className="border-b border-white/5 bg-purple-900/10 hover:bg-purple-900/20 transition-colors"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <td className="py-2 px-4 text-white/70 text-sm pl-8">
                                </td>
                                <td className="py-2 px-4 text-white/70 text-sm font-medium pl-8">
                                  <div className="flex items-center gap-3">
                                    <input
                                      type="checkbox"
                                      checked={isCheckedIn}
                                      onChange={(e) => {
                                        e.stopPropagation();
                                        toggleFamilyMemberSelection(
                                          checkin.checkin_id, 
                                          memberCheckin?.checkin_id || '',
                                          member.id,
                                          member.name,
                                          memberCheckin?.timestamp || new Date().toISOString()
                                        );
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                      className="w-4 h-4 text-purple-600 bg-gray-700 border-gray-600 rounded focus:ring-purple-500 focus:ring-2"
                                    />
                                    {member.name}
                                  </div>
                                </td>
                                <td className="py-2 px-4 text-white/70 text-sm pl-8">
                                  <span className="text-white/40">—</span>
                                </td>
                              </tr>
                            );
                          });
                        })()
                      )}
                    </React.Fragment>
                  )) : (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-white/60">
                        Loading check-ins...
                      </td>
                    </tr>
                  )}
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
  icon: string | React.ReactElement;
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