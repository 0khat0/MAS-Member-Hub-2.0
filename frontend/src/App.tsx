import React, { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import AdminDashboard from './AdminDashboard'
import MemberCheckin from './MemberCheckin'
import ProfilePage from './ProfilePage'
import DedicatedScanner from './DedicatedScanner'
import MemberStats from './MemberStats'
import QRCodeGenerator from './QRCodeGenerator'
import BarcodeGenerator from './BarcodeGenerator'
import AuthFlow from './AuthFlow'
import HomeAuth from './HomeAuth'
import ErrorBoundary from './ErrorBoundary'
import { getSessionOptional } from './lib/session'

// Footer component
const Footer = () => (
  <footer className="text-gray-400 text-center py-3 px-4 mx-4 mb-4 mt-auto">
    <span>
    Made by Omar | 
      <button 
        onClick={reportIssue}
        className="text-gray-400 hover:text-white underline transition-colors duration-200"
      >
        Report Issues
      </button>
    </span>
  </footer>
)

// Report issue function
const reportIssue = () => {
  const issueText = `Issue Report - ${new Date().toISOString()}\n\nPlease describe the issue:\n\n`
  const mailtoLink = `mailto:okhatib@torontomu.ca?subject=MAS Hub Issue Report&body=${encodeURIComponent(issueText)}`
  window.open(mailtoLink)
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const session = await getSessionOptional(5000)
        setIsAuthenticated(!!session)
      } catch (error) {
        console.error('Auth check failed:', error)
        setIsAuthenticated(false)
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <Router>
        <div className="min-h-screen bg-gray-900 text-white flex flex-col">
          <AnimatePresence mode="wait">
            <Routes>
              <Route path="/admin/*" element={<AdminDashboard />} />
              <Route path="/scanner" element={<DedicatedScanner />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/member-stats" element={<MemberStats />} />
              <Route path="/qr-generator" element={<QRCodeGenerator />} />
              <Route path="/barcode-generator" element={<BarcodeGenerator />} />
              <Route 
                path="/checkin" 
                element={
                  isAuthenticated ? (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.3 }}
                    >
                      <MemberCheckin />
                    </motion.div>
                  ) : (
                    <Navigate to="/auth" replace />
                  )
                } 
              />
              <Route 
                path="/auth" 
                element={
                  isAuthenticated ? (
                    <Navigate to="/checkin" replace />
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.3 }}
                    >
                      <AuthFlow />
                    </motion.div>
                  )
                } 
              />
              <Route 
                path="/" 
                element={
                  isAuthenticated ? (
                    <Navigate to="/checkin" replace />
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.3 }}
                    >
                      <HomeAuth />
                    </motion.div>
                  )
                } 
              />
            </Routes>
          </AnimatePresence>
          <Footer />
        </div>
      </Router>
    </ErrorBoundary>
  )
}

export default App