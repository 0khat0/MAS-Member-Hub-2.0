import { Suspense, lazy, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import ErrorBoundary from "./ErrorBoundary";
import './App.css'
import MemberStats from "./MemberStats";
import { getMemberId } from "./utils";

// Lazy load components for better performance
const MemberCheckin = lazy(() => import("./MemberCheckin"));
const AdminDashboard = lazy(() => import("./AdminDashboard"));

// Loading component
const LoadingSpinner = () => (
  <div className="min-h-screen bg-gray-900 flex items-center justify-center">
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full"
    />
  </div>
);

function App() {
  useEffect(() => {
    document.body.style.overflowX = 'hidden';
    return () => { document.body.style.overflowX = ''; };
  }, []);
  return (
    <ErrorBoundary>
      <Router>
        <AppContent />
      </Router>
    </ErrorBoundary>
  );
}

function AppContent() {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith("/admin");

  // Get validated memberId from localStorage for profile
  const memberId = getMemberId();

  return (
    <div className="bg-gray-900 text-white">
      {/* Mobile-optimized navigation */}
      {!isAdminRoute && (
        <nav className="fixed bottom-0 left-0 right-0 bg-black/80 backdrop-blur-lg border-t border-white/10 z-50 safe-area-pb">
          <div className="max-w-lg mx-auto px-4 py-2 flex justify-around items-center">
            <Link 
              to="/checkin" 
              className={`flex flex-col items-center p-2 rounded-lg transition-all duration-300 ${
                location.pathname === "/checkin" || location.pathname === "/"
                  ? "text-red-500 bg-red-500/10" 
                  : "text-white/70 hover:text-white hover:bg-white/5"
              }`}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
              <span className="text-xs mt-1 font-medium">Check-In</span>
            </Link>
            <Link
              to="/profile"
              className={`flex flex-col items-center p-2 rounded-lg transition-all duration-300 ${
                location.pathname === "/profile"
                  ? "text-blue-500 bg-blue-500/10"
                  : "text-white/70 hover:text-white hover:bg-white/5"
              }`}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 15c2.5 0 4.847.655 6.879 1.804M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-xs mt-1 font-medium">Profile</span>
            </Link>
          </div>
        </nav>
      )}

      {/* Main content with page transitions */}
      <main className="pb-20">
        <Suspense fallback={<LoadingSpinner />}>
          <ErrorBoundary>
            <AnimatePresence mode="wait">
              <Routes location={location} key={location.pathname}>
                <Route path="/checkin" element={
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                  >
                    <MemberCheckin />
                  </motion.div>
                } />
                <Route path="/profile" element={
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                  >
                    {/* Only show MemberStats if memberId exists */}
                    {memberId ? <MemberStats memberId={memberId} /> : <div className="text-center text-lg mt-8">No profile found. Please check in first.</div>}
                  </motion.div>
                } />
                <Route path="/admin" element={
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                  >
                    <AdminDashboard />
                  </motion.div>
                } />
                <Route path="/" element={
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                  >
                    <MemberCheckin />
                  </motion.div>
                } />
              </Routes>
            </AnimatePresence>
          </ErrorBoundary>
        </Suspense>
      </main>
    </div>
  );
}

export default App;
