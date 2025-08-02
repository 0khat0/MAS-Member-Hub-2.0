import { useSearchParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { getMemberId, setMemberId } from './utils';
import MemberStats from './MemberStats';

function ProfilePage() {
  const [searchParams] = useSearchParams();
  const [memberId, setMemberIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check URL parameter first
    const urlMemberId = searchParams.get('id');
    
    if (urlMemberId) {
      // If URL has member ID, save it to localStorage and use it
      setMemberId(urlMemberId);
      setMemberIdState(urlMemberId);
      setIsLoading(false);
    } else {
      // Otherwise, check localStorage
      const localMemberId = getMemberId();
      setMemberIdState(localMemberId);
      setIsLoading(false);
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

  return <MemberStats memberId={memberId} />;
}

export default ProfilePage; 