import { useSearchParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { getMemberId, setMemberId, clearMemberData } from './utils';
import MemberStats from './MemberStats';
import { motion, AnimatePresence } from 'framer-motion';

function ProfilePage() {
  const [searchParams] = useSearchParams();
  const [memberId, setMemberIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showToolMenu, setShowToolMenu] = useState(false);
  const [debugMessage, setDebugMessage] = useState('');
  const [showDebugForm, setShowDebugForm] = useState(false);

  useEffect(() => {
    // Check URL parameter first
    const urlMemberId = searchParams.get('id');
    
    if (urlMemberId) {
      // If URL has member ID, save it to localStorage and use it
      setMemberId(urlMemberId);
      setMemberIdState(urlMemberId);
      setIsLoading(false);
      
      // Replace browser history to prevent going back to check-in page
      window.history.replaceState(null, '', `/profile?id=${urlMemberId}`);
    } else {
      // Otherwise, check localStorage
      const localMemberId = getMemberId();
      setMemberIdState(localMemberId);
      setIsLoading(false);
      
      // Replace browser history to prevent going back to check-in page
      if (localMemberId) {
        window.history.replaceState(null, '', `/profile?id=${localMemberId}`);
      }
    }
  }, [searchParams]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div>
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
            href="/checkin"
            className="bg-red-600 hover:bg-red-700 text-white font-semibold px-6 py-2 rounded-lg transition-colors duration-200"
          >
            Go to Check-In
          </a>
        </div>
      </div>
    );
  }

  const handleLogout = () => {
    clearMemberData();
    // Clear browser history and redirect to check-in
    window.history.replaceState(null, '', '/checkin');
    window.location.href = '/checkin';
  };

  const handleDebugSubmit = async () => {
    if (!debugMessage.trim()) return;
    
    // For now, just log the debug message
    console.log('Debug message submitted:', debugMessage);
    
    // You can add API call here later
    // const response = await fetch('/api/debug', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ message: debugMessage, memberId })
    // });
    
    setDebugMessage('');
    setShowDebugForm(false);
    setShowToolMenu(false);
  };

  return (
    <div className="relative">
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
                  onClick={() => setShowDebugForm(true)}
                  className="w-full px-4 py-3 text-left text-white hover:bg-gray-700 transition-colors duration-200 flex items-center gap-3"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  Report Issue
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Debug form modal */}
        <AnimatePresence>
          {showDebugForm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
              onClick={() => setShowDebugForm(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-xl font-semibold text-white mb-4">Report an Issue</h3>
                <textarea
                  value={debugMessage}
                  onChange={(e) => setDebugMessage(e.target.value)}
                  placeholder="Describe the issue you encountered..."
                  className="w-full h-32 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                />
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={handleDebugSubmit}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200"
                  >
                    Submit
                  </button>
                  <button
                    onClick={() => setShowDebugForm(false)}
                    className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200"
                  >
                    Cancel
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      <MemberStats memberId={memberId} />
    </div>
  );
}

export default ProfilePage; 