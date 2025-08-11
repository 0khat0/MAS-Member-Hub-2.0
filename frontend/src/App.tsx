import { Suspense, lazy, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import ErrorBoundary from "./ErrorBoundary";
import './App.css'
import MemberStats from "./MemberStats";
import AuthFlow from "./AuthFlow";
import HomeAuth from "./HomeAuth";
import ProfilePage from "./ProfilePage";
import { getMemberId, reportIssue } from "./utils";
import { apiFetch } from "./lib/session";

// Lazy load components for better performance
const MemberCheckin = lazy(() => import("./MemberCheckin"));
const AdminDashboard = lazy(() => import("./AdminDashboard"));
const DedicatedScanner = lazy(() => import("./DedicatedScanner"));

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

// Footer component
const Footer = () => (
  <footer className="text-gray-400 text-center py-3 px-4 mx-4 mb-4 mt-auto">
    <span>
      Built by Omar Khatib | 
      <button 
        onClick={reportIssue}
        className="text-gray-400 hover:text-white underline transition-colors duration-200"
      >
        Report Issues
      </button> 
      | v2.0
    </span>
  </footer>
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
  const navigate = useNavigate();
  const isAdminRoute = location.pathname.startsWith("/admin");

  // Get validated memberId from localStorage for profile
  const memberId = getMemberId();

  // If user is logged in and tries to access home page, redirect to profile
  useEffect(() => {
    if (memberId && (location.pathname === "/home" || location.pathname === "/")) {
      window.location.href = `/profile?id=${memberId}`;
    }
  }, [memberId, location.pathname]);

  // If not authenticated, route / and /home to /auth to start email+OTP flow
  useEffect(() => {
    const enforceAuth = async () => {
      if (memberId) return;
      if (location.pathname === "/" || location.pathname === "/home") {
        try {
          const r = await apiFetch('/v1/households/me');
          if (r.status === 401) navigate('/auth');
        } catch {
          navigate('/auth');
        }
      }
    };
    enforceAuth();
  }, [location.pathname, memberId, navigate]);

  return (
    <div className="bg-gray-900 text-white min-h-screen flex flex-col">
      {/* Bottom navigation removed - users navigate via registration/sign-in flow */}

      {/* Main content with page transitions */}
      <main className="flex-1">
        <Suspense fallback={<LoadingSpinner />}>
          <ErrorBoundary>
            <AnimatePresence mode="wait">
              <Routes location={location} key={location.pathname}>
                <Route path="/home" element={
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                  >
                    <HomeAuth />
                  </motion.div>
                } />
                <Route path="/auth" element={
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                  >
                    <AuthFlow />
                  </motion.div>
                } />
                <Route path="/profile" element={
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                  >
                    <ProfilePage />
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
                <Route path="/admin/scanner" element={
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                  >
                    <DedicatedScanner />
                  </motion.div>
                } />
                <Route path="/" element={
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                  >
                    <HomeAuth />
                  </motion.div>
                } />
              </Routes>
            </AnimatePresence>
          </ErrorBoundary>
        </Suspense>
      </main>
      
      {/* Footer */}
      <Footer />
    </div>
  );
}

export default App;
