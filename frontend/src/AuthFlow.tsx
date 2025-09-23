import { useState, useCallback } from 'react'
import AuthEmail from './components/AuthEmail'
import AuthOTP from './components/AuthOTP'
import FamilySwitch from './components/FamilySwitch'
import { afterOtpVerified } from './lib/afterOtpVerified'

export default function AuthFlow() {
  const [step, setStep] = useState<'email'|'otp'|'done'>('email')
  const [pendingId, setPendingId] = useState('')
  const [emailMasked, setEmailMasked] = useState('')
  const [rawEmail, setRawEmail] = useState('')
  const [me, setMe] = useState<any | null>(null)
  const [isSignIn, setIsSignIn] = useState(false)
  const [showAuth, setShowAuth] = useState(true)

  // Create a stable cancel function
  const handleCancel = useCallback(() => {
    console.log('Cancelling entire auth flow - function called')
    setShowAuth(false)
    // Reset all state
    setStep('email')
    setPendingId('')
    setEmailMasked('')
    setRawEmail('')
    setMe(null)
    setIsSignIn(false)
  }, [])

  // If auth is cancelled, show nothing (or a message)
  if (!showAuth) {
    return (
      <div className="max-w-sm mx-auto p-4 text-center">
        <p className="text-gray-400">Authentication cancelled</p>
        <button
          onClick={() => setShowAuth(true)}
          className="mt-2 text-blue-400 hover:text-blue-300 underline"
        >
          Try again
        </button>
      </div>
    )
  }

  if (step === 'email') {
    return (
      <div className="max-w-sm mx-auto p-4">
        <h2 className="text-xl font-semibold mb-2">
          {isSignIn ? 'Sign In' : 'Create New Account'}
        </h2>
        <div className="mb-4">
          <div className="flex space-x-2 mb-4">
            <button
              onClick={() => setIsSignIn(false)}
              className={`flex-1 py-2 px-3 rounded transition-colors ${
                !isSignIn 
                  ? 'bg-red-600 text-white' 
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Register
            </button>
            <button
              onClick={() => setIsSignIn(true)}
              className={`flex-1 py-2 px-3 rounded transition-colors ${
                isSignIn 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Sign In
            </button>
          </div>
        </div>
        <AuthEmail 
          onPending={(pid, masked, raw) => { 
            setPendingId(pid); 
            setEmailMasked(masked); 
            setRawEmail(raw); 
            setStep('otp') 
          }} 
          isSignIn={isSignIn}
          onImmediate={async (data) => {
            setMe(data);
            await afterOtpVerified(() => {
              setStep('done')
            })
          }}
        />
        <div className="mt-4 text-center">
          <button
            onClick={handleCancel}
            className="text-gray-400 hover:text-gray-300 text-sm underline"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }
  if (step === 'otp') {
    return (
      <div className="max-w-sm mx-auto p-4">
        <h2 className="text-xl font-semibold mb-2">
          {isSignIn ? 'Sign In' : 'Verify Email'}
        </h2>
        <AuthOTP 
          pendingId={pendingId} 
          emailMasked={emailMasked} 
          rawEmail={rawEmail} 
          isSignIn={isSignIn}
          onVerified={async (data) => {
            setMe(data);
            // If no members yet, prompt user to create one immediately
            if (!data.members || data.members.length === 0) {
              const name = window.prompt('Add your first member. Name:');
              if (name && name.trim().length > 0) {
                try {
                  await fetch('/api/v1/households/members', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ name: name.trim() })
                  });
                } catch {}
              }
            }
            // Use afterOtpVerified to handle iOS PWA cookie race condition
            await afterOtpVerified(() => {
              setStep('done')
            })
          }}
          onBack={() => {
            console.log('Going back to email step')
            setStep('email')
          }}
          onCancel={handleCancel}
        />
      </div>
    )
  }
  return (
    <div className="max-w-sm mx-auto p-4 space-y-3">
      <h2 className="text-xl font-semibold">
        {isSignIn ? 'Welcome Back!' : 'Welcome!'}
      </h2>
      <div className="text-sm text-gray-400">Your Account Number: <span className="font-mono text-white">{me?.householdCode}</span></div>
      {!isSignIn && (
        <div className="text-xs text-gray-500">Save this number for future sign-ins!</div>
      )}
      <FamilySwitch onSelect={(m) => { localStorage.setItem('active_member', JSON.stringify(m)); }} />
    </div>
  )
}


