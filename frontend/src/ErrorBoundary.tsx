import React from 'react';
import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary';
import { motion } from 'framer-motion';

interface ErrorFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

function ErrorFallback({ error, resetErrorBoundary }: ErrorFallbackProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4"
    >
      <div className="max-w-md w-full bg-gray-800 rounded-2xl p-6 text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2 }}
          className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4"
        >
          <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </motion.div>
        
        <h2 className="text-xl font-bold mb-2">Oops! Something went wrong</h2>
        <p className="text-gray-400 mb-6">
          We're sorry for the inconvenience. Please try again or contact support if the problem persists.
        </p>
        
        <div className="space-y-3">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={resetErrorBoundary}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200"
          >
            Try Again
          </motion.button>
          
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => window.location.reload()}
            className="w-full bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200"
          >
            Reload Page
          </motion.button>
        </div>
        
        {import.meta.env.DEV && (
          <details className="mt-6 text-left">
            <summary className="cursor-pointer text-gray-400 hover:text-white">
              Error Details (Development)
            </summary>
            <pre className="mt-2 text-xs bg-gray-900 p-3 rounded overflow-auto text-red-400">
              {error.message}
              {error.stack}
            </pre>
          </details>
        )}
      </div>
    </motion.div>
  );
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

export default function ErrorBoundary({ children }: ErrorBoundaryProps) {
  return (
    <ReactErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={(error, errorInfo) => {
        // Log error to monitoring service in production
        console.error('Error caught by boundary:', error, errorInfo);
        
        // In production, you could send this to a logging service
        if (import.meta.env.PROD) {
          // Example: Send to error tracking service
          // errorTrackingService.captureException(error, { extra: errorInfo });
        }
      }}
      onReset={() => {
        // Clear any cached data that might be causing issues
        localStorage.removeItem('cached-data');
        sessionStorage.clear();
      }}
    >
      {children}
    </ReactErrorBoundary>
  );
} 