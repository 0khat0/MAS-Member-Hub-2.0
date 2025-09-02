import { useSearchParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { getMemberId, setMemberId, clearMemberData, reportIssue } from './utils';
import { clearAppStorage } from './lib/storage';
import MemberStats from './MemberStats';
import FamilySwitch from './components/FamilySwitch';
import { motion, AnimatePresence } from 'framer-motion';
import InstallPWA from './components/InstallPWA';
import { SkeletonProfile } from './components/Skeleton';

function ProfilePage() {
  const [searchParams] = useSearchParams();
  const [memberId, setMemberIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isFamilyUI, setIsFamilyUI] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('family_members');
      if (!saved) return false;
      const arr = JSON.parse(saved);
      return Array.isArray(arr) && arr.length > 1;
    } catch {
      return false;
    }
  });
  const [showToolMenu, setShowToolMenu] = useState(false);

  // Pull-to-refresh (smooth, in-app) for mobile
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showIndicator, setShowIndicator] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);

  useEffect(() => {
    let startY = 0;
    let monitoring = false;
    const threshold = 70; // pixels pulled to trigger refresh

    const onTouchStart = (e: TouchEvent) => {
      if (isRefreshing) return;
      if (window.scrollY <= 0) {
        startY = e.touches[0].clientY;
        monitoring = true;
        setIsPulling(false);
        setPullDistance(0);
      } else {
        monitoring = false;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!monitoring || isRefreshing) return;
      const deltaY = e.touches[0].clientY - startY;
      if (deltaY > 0) {
        setIsPulling(true);
        setPullDistance(Math.min(deltaY, 100));
        setShowIndicator(true);
      }
    };

    const onTouchEnd = () => {
      if (!monitoring || isRefreshing) return;
      if (pullDistance > threshold) {
        setIsRefreshing(true);
        setIsPulling(false);
        setPullDistance(0);
        setShowIndicator(true);
        // Remount data components to re-fetch
        setRefreshVersion((v) => v + 1);
        // Hide spinner after a brief moment regardless of scroll position
        window.setTimeout(() => {
          setIsRefreshing(false);
          setShowIndicator(false);
        }, 900);
      } else {
        setIsPulling(false);
        setPullDistance(0);
        setShowIndicator(false);
      }
      monitoring = false;
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('touchcancel', onTouchEnd as any);
    // Hide indicator on scroll if not actively refreshing
    const onScroll = () => {
      if (!isRefreshing) {
        setIsPulling(false);
        setPullDistance(0);
        setShowIndicator(false);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      window.removeEventListener('touchstart', onTouchStart as any);
      window.removeEventListener('touchmove', onTouchMove as any);
      window.removeEventListener('touchend', onTouchEnd as any);
      window.removeEventListener('touchcancel', onTouchEnd as any);
      window.removeEventListener('scroll', onScroll as any);
    };
  }, [isRefreshing, pullDistance]);


  useEffect(() => {
    // Check URL parameters - support both member ID and family email
    const urlMemberId = searchParams.get('id');
    const urlEmail = searchParams.get('email');
    
    if (urlEmail) {
      // Family profile via email - store family email and use localStorage to get family member IDs
      localStorage.setItem("member_email", urlEmail);
      
      // Try to get the first family member ID from localStorage or fetch family members
      const savedFamilyMembers = localStorage.getItem('family_members');
      if (savedFamilyMembers) {
        // We have family members stored, we'll handle member selection in MemberStats
        setMemberIdState('family'); // Use a special flag for family mode
      } else {
        // No family members cached, we'll fetch them in MemberStats
        setMemberIdState('family');
      }
      setIsLoading(false);
      setIsInitialLoad(false);
      
      // Replace browser history to keep family email
      window.history.replaceState(null, '', `/profile?email=${encodeURIComponent(urlEmail)}`);
    } else if (urlMemberId) {
      // Individual member profile via member ID
      setMemberId(urlMemberId);
      setMemberIdState(urlMemberId);
      setIsLoading(false);
      setIsInitialLoad(false);
      
      // Replace browser history to prevent going back to home page
      window.history.replaceState(null, '', `/profile?id=${urlMemberId}`);
    } else {
      // Otherwise, check localStorage
      const localMemberId = getMemberId();
      setMemberIdState(localMemberId);
      setIsLoading(false);
      setIsInitialLoad(false);
      
      // Replace browser history to prevent going back to home page
      if (localMemberId) {
        window.history.replaceState(null, '', `/profile?id=${localMemberId}`);
      }
    }
  }, [searchParams]);

  // Keep UI in sync with family membership changes
  useEffect(() => {
    const updateFromStorage = () => {
      try {
        const saved = localStorage.getItem('family_members');
        if (!saved) {
          setIsFamilyUI(false);
          return;
        }
        const arr = JSON.parse(saved);
        setIsFamilyUI(Array.isArray(arr) && arr.length > 1);
      } catch {
        setIsFamilyUI(false);
      }
    };

    const onCustom = (e: Event) => {
      // Also update from localStorage on custom event to avoid trusting detail blindly
      updateFromStorage();
    };

    window.addEventListener('storage', updateFromStorage);
    window.addEventListener('mas:familyMembersUpdated', onCustom as EventListener);
    // Run once at mount to ensure freshness
    updateFromStorage();
    return () => {
      window.removeEventListener('storage', updateFromStorage);
      window.removeEventListener('mas:familyMembersUpdated', onCustom as EventListener);
    };
  }, []);

  if (isLoading && isInitialLoad) {
    return (
      <div className="min-h-screen bg-gray-900 p-4">
        <div className="max-w-4xl mx-auto">
          <SkeletonProfile />
        </div>
      </div>
    );
  }

  if (!memberId) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-white mb-2">No Profile Found</h2>
          <p className="text-white/70 mb-4">Please register or check in first.</p>
                     <a
             href="/home"
             className="bg-red-600 hover:bg-red-700 text-white font-semibold px-6 py-2 rounded-lg transition-colors duration-200"
           >
                         Go Back Home
          </a>
        </div>
      </div>
    );
  }

  const handleLogout = async () => {
    try {
      // Call backend logout to clear cookie
      const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
      await fetch(`${API_URL}/v1/auth/logout`, {
        method: 'POST',
        credentials: 'include'
      });
    } catch (error) {
      console.error('Logout API call failed:', error);
    }
    
    // Clear session data but preserve user preferences like goals
    clearMemberData();
    clearAppStorage();
    
    // Clear browser history and redirect to home
    window.history.replaceState(null, '', '/home');
    window.location.href = '/home';
  };

  const handleReportIssue = () => {
    reportIssue();
    setShowToolMenu(false);
  };

  const handleDeleteAccount = async () => {
    if (!memberId || memberId === 'family') {
      alert('Cannot delete account in family mode');
      return;
    }

    const confirmed = window.confirm(
      'Are you sure you want to delete your account? This action cannot be undone and will permanently remove all your data.'
    );

    if (!confirmed) {
      return;
    }

    try {
      const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
      console.log('Attempting to delete account:', memberId);
      console.log('API URL:', API_URL);
      
      const response = await fetch(`${API_URL}/member/${memberId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);

      if (response.ok) {
        // Clear all data and redirect to home
        clearMemberData();
        window.history.replaceState(null, '', '/home');
        window.location.href = '/home';
      } else {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        console.error('Delete account error:', errorData);
        alert(`Failed to delete account: ${errorData.detail || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error deleting account:', error);
      alert(`Failed to delete account: ${error instanceof Error ? error.message : 'Network error'}`);
    }

    setShowToolMenu(false);
  };

  const handleDeleteFamily = async () => {
    const memberEmail = localStorage.getItem('member_email');
    if (!memberEmail) {
      alert('No family email found');
      return;
    }

    const confirmed = window.confirm(
      'Are you sure you want to delete the entire family account? This action cannot be undone and will permanently remove all family members and their data.'
    );

    if (!confirmed) {
      return;
    }

    try {
      const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
      console.log('Attempting to delete family:', memberEmail);
      
      // Delete the entire family account (including household and account number)
      const response = await fetch(`${API_URL}/family/${encodeURIComponent(memberEmail)}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(`Failed to delete family account: ${errorData.detail || 'Unknown error'}`);
      }

      const result = await response.json();
      console.log('Family deletion result:', result);

      // Clear all data and redirect to home
      clearMemberData();
      window.history.replaceState(null, '', '/home');
      window.location.href = '/home';
    } catch (error) {
      console.error('Error deleting family:', error);
      alert(`Failed to delete family: ${error instanceof Error ? error.message : 'Network error'}`);
    }

    setShowToolMenu(false);
  };

  return (
    <div className="relative">
      {/* Pull-to-refresh indicator */}
      <div
        className="fixed left-0 right-0 top-0 z-40 flex justify-center pointer-events-none"
        style={{ transform: `translateY(${isPulling ? Math.min(pullDistance, 60) : 0}px)`, transition: isPulling ? 'none' : 'transform 200ms ease' }}
      >
        {showIndicator && (
          <div className="mt-2 w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin bg-transparent"></div>
        )}
      </div>
      {/* Tool menu button - top right corner */}
      <div className="fixed top-4 right-4 z-50">
        <button
          onClick={() => setShowToolMenu(!showToolMenu)}
          className="w-12 h-12 bg-gray-800 hover:bg-gray-700 text-white rounded-full flex items-center justify-center transition-all duration-200 shadow-lg hover:shadow-xl border border-gray-600"
          title="Tools"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>

        {/* Tool menu dropdown */}
        <AnimatePresence>
          {showToolMenu && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ duration: 0.2 }}
              className="absolute right-0 mt-2 w-64 bg-gray-800 border border-gray-600 rounded-lg shadow-xl overflow-hidden"
            >
              <div className="py-2">
                <button
                  onClick={handleLogout}
                  className="w-full px-4 py-3 text-left text-white hover:bg-gray-700 transition-colors duration-200 flex items-center gap-3"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Logout
                </button>
                <button
                  onClick={handleReportIssue}
                  className="w-full px-4 py-3 text-left text-white hover:bg-gray-700 transition-colors duration-200 flex items-center gap-3"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  Report Issue
                </button>
                {isFamilyUI ? (
                  <button
                    onClick={handleDeleteFamily}
                    className="w-full px-4 py-3 text-left text-white hover:bg-gray-700 transition-colors duration-200 flex items-center gap-3"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete Family Account
                  </button>
                ) : (
                  <button
                    onClick={handleDeleteAccount}
                    className="w-full px-4 py-3 text-left text-white hover:bg-gray-700 transition-colors duration-200 flex items-center gap-3"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete Account
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>


      </div>
      
      {/* Quick family switcher (local switching) */}
      {memberId && (
        <div className="max-w-md mx-auto p-3">
          <FamilySwitch onSelect={(m) => {
            localStorage.setItem('active_member', JSON.stringify(m));
            // Keep current page; other components can read active member
          }} />
        </div>
      )}
      {/* Key forces re-mount after pull-to-refresh to trigger fresh data fetch */}
      <MemberStats key={`stats-${memberId}-${refreshVersion}`} memberId={memberId} />
      
      {/* Add to Home Screen prompt */}
      <InstallPWA appName="MAS Hub" />
    </div>
  );
}

export default ProfilePage; 