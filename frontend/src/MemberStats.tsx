import { useState, useEffect } from 'react';
import { isValidUUID, getApiUrl, clearMemberData, getEasternTime, getEasternDateString, getEasternDateTimeString, getMondayOfCurrentWeekEastern } from './utils';
import QRCodeGenerator from './QRCodeGenerator';

interface MemberStats {
  monthly_check_ins: number;
  current_streak: number;
  highest_streak: number;
  member_since: string;
  check_in_dates?: string[];
  name?: string;
  email?: string;
  barcode?: string;
}

interface FamilyMember {
  id: string;
  name: string;
  email: string;
  is_deleted: boolean;
  deleted_at?: string;
}

interface Props {
  memberId: string;
}

const DEFAULT_GOAL = 3;

function MemberStats({ memberId }: Props) {
  const [stats, setStats] = useState<MemberStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Initialize goal from localStorage immediately
  const getInitialGoal = () => {
    if (memberId && isValidUUID(memberId)) {
      const memberKey = `checkin_goal_${memberId}`;
      const saved = localStorage.getItem(memberKey);
      return saved ? parseInt(saved, 10) : DEFAULT_GOAL;
    }
    return DEFAULT_GOAL;
  };
  
  const [goal, setGoal] = useState<number>(getInitialGoal());
  const [weeklyCheckins, setWeeklyCheckins] = useState<number>(0);
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Family member states
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string>(memberId);
  const [isFamily, setIsFamily] = useState(false);
  const [familyFetchComplete, setFamilyFetchComplete] = useState(false);

  // Declare selectedMember early to prevent initialization errors
  const selectedMember = familyMembers.find(m => m.id === selectedMemberId);

  // Immediate goal loading on component mount
  useEffect(() => {
    console.log('🔍 Component Mount - Loading Goal:', {
      memberId,
      isFamily,
      isValidUUID: isValidUUID(memberId)
    });
    
    if (memberId && isValidUUID(memberId)) {
      const memberKey = `checkin_goal_${memberId}`;
      const saved = localStorage.getItem(memberKey);
      const newGoal = saved ? parseInt(saved, 10) : DEFAULT_GOAL;
      console.log('🔍 Initial Goal Load:', { memberId, memberKey, saved, newGoal });
      setGoal(newGoal);
    }
  }, []); // Empty dependency array - runs only on mount

  // Expose refresh function globally for external access
  useEffect(() => {
    const refreshStats = async () => {
      if (memberId === 'family' && selectedMemberId) {
        // Re-fetch stats for selected family member
        try {
          setIsLoading(true);
          const API_URL = getApiUrl();
          const response = await fetch(`${API_URL}/member/${selectedMemberId}/stats`);
          
          if (!response.ok) {
            if (response.status === 404) {
              setError('Member not found. Please check in again.');
              clearMemberData();
              return;
            }
            throw new Error(`HTTP ${response.status}`);
          }

          const data = await response.json();
          setStats(data);
          setError(null);

          // Calculate weekly check-ins for the selected member
          if (data && data.check_in_dates && Array.isArray(data.check_in_dates)) {
            const now = getEasternTime();
            const monday = getMondayOfCurrentWeekEastern(now);
            
            const mondayString = getEasternDateString(monday);
            const todayString = getEasternDateString(now);
            
            const weekCheckins = data.check_in_dates.filter((d: string) => {
              const checkinDateString = d.split('T')[0];
              return checkinDateString >= mondayString && checkinDateString <= todayString;
            }).length;
            setWeeklyCheckins(weekCheckins);
          } else {
            setWeeklyCheckins(0);
          }
        } catch (error) {
          console.error('Error refreshing selected member stats:', error);
        } finally {
          setIsLoading(false);
        }
      } else if (memberId && isValidUUID(memberId)) {
        // Re-fetch stats for individual member
        try {
          const API_URL = getApiUrl();
          const response = await fetch(`${API_URL}/member/${memberId}/stats`);
          
          if (response.ok) {
            const data = await response.json();
            setStats(data);
            setEditName(data.name || '');
            setEditEmail(data.email || '');
            if (data && data.check_in_dates && Array.isArray(data.check_in_dates)) {
              const now = getEasternTime();
              const monday = getMondayOfCurrentWeekEastern(now);
              
              const mondayString = getEasternDateString(monday);
              const todayString = getEasternDateString(now);
              
              const weekCheckins = data.check_in_dates.filter((d: string) => {
                const checkinDateString = d.split('T')[0];
                return checkinDateString >= mondayString && checkinDateString <= todayString;
              }).length;
              setWeeklyCheckins(weekCheckins);
            } else {
              setWeeklyCheckins(0);
            }
          }
        } catch (error) {
          console.error('Error refreshing stats:', error);
        }
      }
    };

    (window as any).refreshMemberStats = refreshStats;
    return () => {
      delete (window as any).refreshMemberStats;
    };
  }, [memberId, selectedMemberId]);

  useEffect(() => {
    // Handle family mode
    if (memberId === 'family') {
      setIsFamily(true);
      // In family mode, we'll fetch family members and then get stats for the selected member
      const memberEmail = localStorage.getItem('member_email');
      if (!memberEmail) {
        setError('No family email found. Please check in again.');
        setIsLoading(false);
        return;
      }
      // We'll handle fetching family members and stats in the family fetch effect below
      return;
    }

    // Check if this is a family account (legacy individual member ID approach)
    const savedFamilyMembers = localStorage.getItem('family_members');
    if (savedFamilyMembers) {
      try {
        const members = JSON.parse(savedFamilyMembers);
        setIsFamily(members.length > 1);
      } catch (e) {
        console.error('Error parsing family members:', e);
      }
    }

    // Validate memberId before making API call
    if (!isValidUUID(memberId)) {
      setError('Invalid member ID. Please check in again.');
      setIsLoading(false);
      clearMemberData();
      return;
    }

    const fetchStats = async () => {
      try {
        const API_URL = getApiUrl();
        const response = await fetch(`${API_URL}/member/${memberId}/stats`);
        
        if (!response.ok) {
          if (response.status === 404) {
            setError('Member not found. Please check in again.');
            clearMemberData();
          } else {
            setError('Failed to load profile. Please try again.');
          }
          return;
        }
        
        const data = await response.json();
        console.log('Member stats data:', data); // Debug log
        console.log('Barcode from API:', data.barcode); // Debug log
        setStats(data);
        setEditName(data.name || '');
        setEditEmail(data.email || '');
        if (data && data.check_in_dates && Array.isArray(data.check_in_dates)) {
          const now = getEasternTime();
          const monday = getMondayOfCurrentWeekEastern(now);
          
          const mondayString = getEasternDateString(monday);
          const todayString = getEasternDateString(now);
          
          const weekCheckins = data.check_in_dates.filter((d: string) => {
            const checkinDateString = d.split('T')[0]; // Get just the date part from ISO string
            return checkinDateString >= mondayString && checkinDateString <= todayString;
          }).length;
          setWeeklyCheckins(weekCheckins);
        } else {
          setWeeklyCheckins(0);
        }
      } catch (error) {
        console.error('Error fetching member stats:', error);
        setError('Network error. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchStats();
  }, [memberId]);

  // On profile page load, always fetch latest family members and update state
  useEffect(() => {
    const fetchAndSyncFamilyMembers = async () => {
      const memberEmail = localStorage.getItem('member_email');
      console.log('Profile Debug: Starting family fetch', {
        memberEmail,
        memberId,
        localStorage_member_id: localStorage.getItem('member_id')
      });
      if (memberEmail) {
        const API_URL = getApiUrl();
        try {
          const response = await fetch(`${API_URL}/family/members/${encodeURIComponent(memberEmail)}`);
          if (response.ok) {
            const data = await response.json();
            console.log('🔍 Debug: Family members from API:', data);
            setFamilyMembers(data || []);
            // Update localStorage with current family members
            const memberNames = data.map((m: any) => m.name);
            localStorage.setItem('family_members', JSON.stringify(memberNames));
            // If only one member, switch to single-user mode
            setIsFamily((data || []).length > 1);
            
            // For family mode, also set the first member as selected if no member is selected
            if (memberId === 'family' && data && data.length > 0) {
              console.log('🔍 Debug: Setting selected member ID to:', data[0].id);
              setSelectedMemberId(data[0].id);
              setEditName(data[0].name);
              setEditEmail(data[0].email);
            }
          }
        } catch (e) {
          // Ignore errors
        } finally {
          setFamilyFetchComplete(true);
        }
      } else {
        // No email found, mark fetch as complete so we can show appropriate error
        setFamilyFetchComplete(true);
      }
    };
    fetchAndSyncFamilyMembers();
  }, []);

  // After fetching family members, handle the case where there are no members left
  useEffect(() => {
    // Only check for "no members" after family fetch is complete
    if (familyFetchComplete && familyMembers.length === 0) {
      // Clear localStorage and prompt user to check in again
      localStorage.removeItem('member_id');
      localStorage.removeItem('family_members');
      localStorage.removeItem('member_email');
      setError('No members found. Please check in or register again.');
    } else if (familyMembers.length > 0 && (!selectedMemberId || !familyMembers.find(m => m.id === selectedMemberId))) {
      // If selectedMemberId is invalid, select the first available member
      setSelectedMemberId(familyMembers[0].id);
      setEditName(familyMembers[0].name);
      setEditEmail(familyMembers[0].email);
    }
  }, [familyMembers, selectedMemberId, familyFetchComplete]);

  // Fetch stats for selected member
  useEffect(() => {
    if (selectedMemberId && selectedMemberId !== memberId) {
      fetchMemberStats(selectedMemberId);
    }
  }, [selectedMemberId]);

  const fetchMemberStats = async (memberIdToFetch: string) => {
    try {
      const API_URL = getApiUrl();
      const response = await fetch(`${API_URL}/member/${memberIdToFetch}/stats`);
      
      if (response.ok) {
        const data = await response.json();
        setStats(data);
        setEditName(data.name || '');
        setEditEmail(data.email || '');
        
        if (data && data.check_in_dates && Array.isArray(data.check_in_dates)) {
          const now = getEasternTime();
          const monday = getMondayOfCurrentWeekEastern(now);
          
          const mondayString = getEasternDateString(monday);
          const todayString = getEasternDateString(now);
          
          const weekCheckins = data.check_in_dates.filter((d: string) => {
            const checkinDateString = d.split('T')[0];
            return checkinDateString >= mondayString && checkinDateString <= todayString;
          }).length;
          setWeeklyCheckins(weekCheckins);
        } else {
          setWeeklyCheckins(0);
        }
      } else {
        setError('Failed to load member stats.');
      }
    } catch (error) {
      console.error('Error fetching member stats:', error);
      setError('Network error. Please try again.');
    }
  };

  const handleMemberUpdate = async (memberIdToUpdate: string, name: string, email: string) => {
    setEditError('');
    setEditSuccess('');
    setIsUpdating(true);
    try {
      const API_URL = getApiUrl();
      console.log('🔍 Debug: Updating member', {
        memberIdToUpdate,
        name,
        email,
        API_URL: `${API_URL}/member/${memberIdToUpdate}`,
        isValidUUID: isValidUUID(memberIdToUpdate),
        selectedMemberId,
        familyMembers: familyMembers.map(m => ({ id: m.id, name: m.name, email: m.email }))
      });
      
      // Validate memberIdToUpdate is a valid UUID
      if (!isValidUUID(memberIdToUpdate)) {
        console.error('❌ Invalid member ID:', memberIdToUpdate);
        setEditError('Invalid member ID. Please refresh the page and try again.');
        return;
      }
      
      const res = await fetch(`${API_URL}/member/${memberIdToUpdate}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      });
      
      console.log('🔍 Debug: Response status', res.status);
      console.log('🔍 Debug: Response ok', res.ok);
      
      if (res.ok) {
        setEditSuccess('Profile updated successfully!');
        setEditMode(false);
        
        // Update stats for the current member
        setStats((prev) => prev ? { ...prev, name, email } : prev);
        
        // For families, handle email updates (backend updates all family members automatically)
        if (isFamily) {
          const currentEmail = familyMembers.find(m => m.id === memberIdToUpdate)?.email;
          
          // If email changed, update ALL family members' emails (since backend updates them all)
          if (currentEmail && currentEmail !== email) {
            setFamilyMembers(prev => prev.map(member => ({
              ...member,
              email: email  // Update ALL family members' emails
            })));
            
            // Update localStorage with new family email
            localStorage.setItem("member_email", email);
            
            // Refresh family members from server to ensure consistency
            setTimeout(() => {
              const fetchUpdatedFamilyMembers = async () => {
                try {
                  const response = await fetch(`${API_URL}/family/members/${encodeURIComponent(email)}`);
                  if (response.ok) {
                    const data = await response.json();
                    setFamilyMembers(data || []);
                  }
                } catch (e) {
                  console.error('Error refreshing family members:', e);
                }
              };
              fetchUpdatedFamilyMembers();
            }, 500);
          } else {
            // Only name changed, update just this member
            setFamilyMembers(prev => prev.map(member => 
              member.id === memberIdToUpdate 
                ? { ...member, name, email }
                : member
            ));
          }
        } else {
          // Individual member - update localStorage if needed
          localStorage.setItem("member_email", email);
        }
      } else {
        const data = await res.json();
        console.log('🔍 Debug: Error response', data);
        setEditError(data.detail || 'Failed to update profile.');
      }
    } catch (err) {
      console.error('Update error:', err);
      console.log('🔍 Debug: Full error object', err);
      setEditError('Network error. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  // Load goal from localStorage when component mounts or selected member changes
  useEffect(() => {
    console.log('🔍 Goal Loading Effect Triggered:', {
      isFamily,
      selectedMemberId,
      memberId,
      familyMembersLength: familyMembers.length,
      familyFetchComplete
    });
    
    if (isFamily && selectedMemberId && familyMembers.length > 0 && familyFetchComplete) {
      // For family members, load goal for the selected member
      const memberKey = `checkin_goal_${selectedMemberId}`;
      const saved = localStorage.getItem(memberKey);
      const newGoal = saved ? parseInt(saved, 10) : DEFAULT_GOAL;
      console.log('🔍 Loading Family Goal:', { selectedMemberId, memberKey, saved, newGoal });
      setGoal(newGoal);
    } else if (!isFamily && memberId && isValidUUID(memberId)) {
      // For individual members, load goal for the member
      const memberKey = `checkin_goal_${memberId}`;
      const saved = localStorage.getItem(memberKey);
      const newGoal = saved ? parseInt(saved, 10) : DEFAULT_GOAL;
      console.log('🔍 Loading Individual Goal:', { memberId, memberKey, saved, newGoal });
      setGoal(newGoal);
    }
  }, [familyMembers.length, selectedMemberId, memberId, isFamily, familyFetchComplete]);

  // Additional useEffect for individual member goal loading (doesn't depend on familyFetchComplete)
  useEffect(() => {
    console.log('🔍 Individual Goal Loading Effect:', {
      isFamily,
      memberId,
      isValidUUID: isValidUUID(memberId)
    });
    
    if (!isFamily && memberId && isValidUUID(memberId)) {
      const memberKey = `checkin_goal_${memberId}`;
      const saved = localStorage.getItem(memberKey);
      const newGoal = saved ? parseInt(saved, 10) : DEFAULT_GOAL;
      console.log('🔍 Goal Loading Debug:', {
        memberId,
        memberKey,
        saved,
        newGoal,
        isFamily,
        isValidUUID: isValidUUID(memberId)
      });
      setGoal(newGoal);
    }
  }, [memberId, isFamily]);

  // Save goal when it changes
  useEffect(() => {
    if (isFamily && selectedMemberId) {
      const memberKey = `checkin_goal_${selectedMemberId}`;
      localStorage.setItem(memberKey, goal.toString());
      console.log('🔍 Goal Saving Debug (Family):', {
        selectedMemberId,
        memberKey,
        goal,
        savedValue: goal.toString()
      });
    } else if (!isFamily && memberId && isValidUUID(memberId)) {
      const memberKey = `checkin_goal_${memberId}`;
      localStorage.setItem(memberKey, goal.toString());
      console.log('🔍 Goal Saving Debug (Individual):', {
        memberId,
        memberKey,
        goal,
        savedValue: goal.toString()
      });
    }
  }, [goal, memberId, isFamily, selectedMemberId]);

  // When switching selectedMemberId, update editName and editEmail to match the selected member
  useEffect(() => {
    if (selectedMember) {
      setEditName(selectedMember.name || '');
      setEditEmail(selectedMember.email || '');
    }
  }, [selectedMemberId, familyMembers]);

  // Fetch stats for selected member in family mode
  useEffect(() => {
    if (memberId === 'family' && selectedMemberId && isValidUUID(selectedMemberId)) {
      const fetchSelectedMemberStats = async () => {
        try {
          setIsLoading(true);
          const API_URL = getApiUrl();
          const response = await fetch(`${API_URL}/member/${selectedMemberId}/stats`);
          
          if (!response.ok) {
            if (response.status === 404) {
              setError('Member not found. Please check in again.');
              clearMemberData();
              return;
            }
            throw new Error(`HTTP ${response.status}`);
          }

          const data = await response.json();
          setStats(data);
          setError(null);

          // Calculate weekly check-ins for the selected member
          if (data && data.check_in_dates && Array.isArray(data.check_in_dates)) {
            const now = getEasternTime();
            const monday = getMondayOfCurrentWeekEastern(now);
            
            const mondayString = getEasternDateString(monday);
            const todayString = getEasternDateString(now);
            
            const weekCheckins = data.check_in_dates.filter((d: string) => {
              const checkinDateString = d.split('T')[0]; // Get just the date part from ISO string
              return checkinDateString >= mondayString && checkinDateString <= todayString;
            }).length;
            setWeeklyCheckins(weekCheckins);
          } else {
            setWeeklyCheckins(0);
          }
        } catch (error) {
          console.error('Error fetching selected member stats:', error);
          setError('Network error. Please try again.');
        } finally {
          setIsLoading(false);
        }
      };
      
      fetchSelectedMemberStats();
    }
  }, [selectedMemberId, memberId]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-48">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-900 rounded-xl p-6">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-white mb-2">Profile Error</h2>
          <p className="text-white/70 mb-4">{error}</p>
          <button
            onClick={() => window.location.href = '/home'}
            className="bg-red-600 hover:bg-red-700 text-white font-semibold px-6 py-2 rounded-lg transition-colors duration-200"
          >
            Go Back Home
          </button>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="bg-gray-900 rounded-xl p-6">
        <div className="text-center">
          <p className="text-white/70">No profile data available.</p>
        </div>
      </div>
    );
  }

  const percent = Math.round((weeklyCheckins / goal) * 100);

  return (
    <div className="min-h-screen w-full bg-gray-900 font-poppins overflow-x-hidden">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* QR Code Section (no card/box, always at the top) */}
        <div className="flex justify-center my-6">
          {(() => {
            let qrData = null;
            if (isFamily && familyMembers.length > 1) {
              // For family, use the primary member's barcode
              qrData = stats.barcode;
            } else if (stats.barcode) {
              // For individual member, just use the barcode
              qrData = stats.barcode;
            }
            return qrData ? (
              <QRCodeGenerator data={qrData} />
            ) : (
              <div className="text-gray-400">No QR code available</div>
            );
          })()}
        </div>
        {/* Family Members Section (only if family) */}
        {isFamily && familyMembers.length > 1 && (
          <div className="bg-[#181c23] border border-gray-700 rounded-2xl shadow-xl p-8 mb-4">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center">
                <span className="text-white text-lg">👨‍👩‍👧‍👦</span>
              </div>
              <h2 className="text-2xl font-extrabold text-white">Family Members</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {familyMembers.filter(m => !m.is_deleted).map((member) => (
                <button
                  key={member.id}
                  onClick={() => setSelectedMemberId(member.id)}
                  className={`w-full text-left rounded-lg border-2 px-4 py-3 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500 font-semibold ${selectedMemberId === member.id ? 'border-purple-500 bg-purple-900/40 text-white' : 'border-gray-600 bg-gray-800/60 text-white/80 hover:bg-purple-800/20'}`}
                >
                  <div className="text-lg font-bold">{member.name}</div>
                  <div className="text-sm text-white/60">{member.email}</div>
                </button>
              ))}
            </div>
          </div>
        )}
        {/* Profile Section */}
        <div className="bg-[#181c23] border border-gray-700 rounded-2xl shadow-xl p-8 mb-4">
          <div className="mb-6 flex items-center gap-3">
            <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h2 className="text-2xl font-extrabold text-white">
              {isFamily ? `${selectedMember?.name || 'Member'}'s Profile` : 'My Profile'}
            </h2>
          </div>
          <div className="w-16 h-1 rounded-full bg-gradient-to-r from-red-500 to-red-700 mb-6" />
          {editMode ? (
            <form
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                
                // Basic validation
                if (!editName.trim()) {
                  setEditError('Name is required.');
                  return;
                }
                
                if (!editEmail.trim()) {
                  setEditError('Email is required.');
                  return;
                }
                
                // Validate full name (first and last)
                if (!/^\s*\S+\s+\S+/.test(editName.trim())) {
                  setEditError('Please enter your full name (first and last).');
                  return;
                }
                
                await handleMemberUpdate(selectedMemberId, editName.trim(), editEmail.trim());
              }}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-white/70 text-sm font-medium mb-2">Full Name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200"
                    placeholder="Enter your full name"
                    required
                  />
                </div>
                <div>
                  <label className="block text-white/70 text-sm font-medium mb-2">Email Address</label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={e => setEditEmail(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200"
                    placeholder="Enter your email"
                    required
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isUpdating}
                  className={`font-semibold px-6 py-3 rounded-lg transition-colors duration-200 flex items-center gap-2 ${
                    isUpdating 
                      ? 'bg-gray-600 cursor-not-allowed' 
                      : 'bg-blue-600 hover:bg-blue-700'
                  } text-white`}
                >
                  {isUpdating ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  {isUpdating ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  disabled={isUpdating}
                  className="bg-gray-600 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-6 py-3 rounded-lg transition-colors duration-200"
                  onClick={() => { 
                    setEditMode(false); 
                    setEditError(''); 
                    setEditSuccess('');
                    setEditName(selectedMember?.name || stats.name || '');
                    setEditEmail(selectedMember?.email || stats.email || '');
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-white/70 text-sm font-medium mb-2">Full Name</label>
                  <input
                    type="text"
                    value={editName}
                    readOnly
                    className="w-full px-4 py-3 rounded-lg bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200 opacity-70 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-white/70 text-sm font-medium mb-2">Email Address</label>
                  <input
                    type="email"
                    value={editEmail}
                    readOnly
                    className="w-full px-4 py-3 rounded-lg bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200 opacity-70 cursor-not-allowed"
                  />
                </div>
              </div>
              <button
                type="button"
                className="bg-red-600 hover:bg-red-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors duration-200 flex items-center gap-2"
                onClick={() => {
                  setEditMode(true);
                  setEditError('');
                  setEditSuccess('');
                }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Edit Profile
              </button>
            </div>
          )}
          {editError && (
              <div className="mt-4 p-3 bg-red-100 border border-red-300 rounded-lg text-red-700 text-sm">{editError}</div>
          )}
          {editSuccess && (
              <div className="mt-4 p-3 bg-green-100 border border-green-300 rounded-lg text-green-700 text-sm">{editSuccess}</div>
          )}
        </div>
        {/* Stats Section (card with 3 inner boxes) */}
        <div className="bg-[#181c23] border border-gray-700 rounded-2xl shadow-xl p-8 mb-4">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2m0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h2 className="text-2xl font-extrabold text-white">
              {isFamily ? `${selectedMember?.name || 'Member'}'s Stats` : 'My Stats'}
            </h2>
          </div>
          <div className="w-16 h-1 rounded-full bg-gradient-to-r from-blue-500 to-blue-700 mb-6" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
            {/* Current Streak Card */}
            <div className="bg-[#232736] border border-gray-600 rounded-xl p-6 flex flex-col items-center justify-center">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-3xl text-red-500">🔥</span>
                <span className="text-lg font-bold text-white">Current Streak</span>
              </div>
              <div className="text-4xl font-extrabold text-white mb-1">{stats.current_streak}</div>
              <div className="text-sm text-white/70">Best: {stats.highest_streak} days</div>
            </div>
            {/* This Week Progress Card */}
            <div className="bg-[#232736] border border-gray-600 rounded-xl p-6 flex flex-col items-center justify-center">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-3xl text-yellow-400">🏋️‍♂️</span>
                <span className="text-lg font-bold text-white">This Week</span>
              </div>
              <div className="text-4xl font-extrabold text-white mb-1">{weeklyCheckins} <span className="text-lg font-normal">/ {goal}</span></div>
              <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden my-2">
                <div className="h-full bg-red-500 rounded-full" style={{ width: `${Math.min((weeklyCheckins / goal) * 100, 100)}%` }} />
              </div>
              <div className="text-xs text-white/60">{percent}% of weekly goal</div>
              <div className="flex items-center gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setGoal(Math.max(1, goal - 1))}
                  className="w-7 h-7 rounded-full bg-gray-600 hover:bg-gray-500 text-white font-bold text-lg flex items-center justify-center transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-500"
                  disabled={goal <= 1}
                >
                  -
                </button>
                <input
                  type="number"
                  min="1"
                  max="7"
                  value={goal}
                  onChange={e => {
                    const value = parseInt(e.target.value) || 1;
                    const clampedValue = Math.max(1, Math.min(7, value));
                    setGoal(clampedValue);
                  }}
                  onBlur={e => {
                    const value = parseInt(e.target.value) || 1;
                    const clampedValue = Math.max(1, Math.min(7, value));
                    setGoal(clampedValue);
                  }}
                  className="w-12 px-2 py-1 rounded bg-gray-700 text-white border border-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 text-center text-sm font-semibold"
                  style={{ WebkitAppearance: 'none', MozAppearance: 'textfield' }}
                />
                <button
                  type="button"
                  onClick={() => setGoal(Math.min(7, goal + 1))}
                  className="w-7 h-7 rounded-full bg-gray-600 hover:bg-gray-500 text-white font-bold text-lg flex items-center justify-center transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-500"
                  disabled={goal >= 7}
                >
                  +
                </button>
              </div>
            </div>
            {/* Monthly Home Page Card */}
            <div className="bg-[#232736] border border-gray-600 rounded-xl p-6 flex flex-col items-center justify-center">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-3xl text-blue-400">📅</span>
                <span className="text-lg font-bold text-white">This Month</span>
              </div>
              <div className="text-4xl font-extrabold text-white mb-1">{stats.monthly_check_ins}</div>
                              <div className="text-sm text-white/70">Home Page</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MemberStats;