import { useEffect, useState, useRef } from 'react'
import { apiFetch } from '../lib/session'

type Props = {
  pendingId: string
  emailMasked: string
  rawEmail: string
  onVerified: (payload: any) => void
  onBack: () => void
  onCancel: () => void
  isSignIn?: boolean
}

export default function AuthOTP({ pendingId, emailMasked, rawEmail, onVerified, onBack, onCancel, isSignIn = false }: Props) {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [attempts, setAttempts] = useState(0)
  const [resendAttempts, setResendAttempts] = useState(0)
  const [maxAttempts] = useState(5)
  const [maxResendAttempts] = useState(3)
  const [isNavigating, setIsNavigating] = useState(false)
  
  const inputRef = useRef<HTMLInputElement>(null)



  // Auto-focus on OTP input when component mounts
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus()
      // Select all text for easy replacement
      inputRef.current.select()
    }
  }, [])

  // Create a local cancel handler to ensure it's always a function
  const handleCancel = () => {
    if (typeof onCancel === 'function') {
      setIsNavigating(true)
      // Add a small delay to prevent immediate backend conflicts
      setTimeout(() => {
        onCancel()
      }, 100)
    } else {
      console.error('onCancel is not a function:', onCancel)
    }
  }

  // Handle back navigation
  const handleBack = () => {
    if (typeof onBack === 'function') {
      setIsNavigating(true)
      // Add a small delay to prevent immediate backend conflicts
      setTimeout(() => {
        onBack()
      }, 100)
    }
  }

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setInterval(() => setCooldown((c) => c - 1), 1000)
    return () => clearInterval(t)
  }, [cooldown])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (attempts >= maxAttempts) {
      setError('Too many failed attempts. Please request a new code.')
      return
    }

    setError(null)
    setSuccess(null)
    setLoading(true)
    
    try {
      const res = await apiFetch('/v1/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ pendingId, code })
      })
      
      if (!res.ok) {
        if (res.status === 400) {
          setAttempts(prev => prev + 1)
          const remaining = maxAttempts - attempts - 1
          if (remaining > 0) {
            setError(`Invalid code. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`)
          } else {
            setError('Too many failed attempts. Please request a new code.')
          }
        } else if (res.status === 410) {
          setError('Code has expired. Please request a new one.')
        } else {
          setError('Verification failed. Please try again.')
        }
        return
      }
      
      const data = await res.json()
      setSuccess('Code verified successfully!')
      onVerified(data)
    } catch (e: any) {
      setAttempts(prev => prev + 1)
      setError('Network error. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  const resend = async () => {
    if (resendAttempts >= maxResendAttempts) {
      setError('Too many resend attempts. Please wait a few minutes.')
      return
    }

    setError(null)
    setSuccess(null)
    setResendLoading(true)
    
    try {
      // Use a dedicated resend endpoint if available, fallback to start
      const endpoint = '/v1/auth/resend'
      const res = await apiFetch(endpoint, { 
        method: 'POST', 
        body: JSON.stringify({ 
          pendingId, 
          email: rawEmail,
          isSignIn 
        }) 
      })
      
      if (!res.ok) {
        if (res.status === 429) {
          const retryAfter = res.headers.get('Retry-After')
          const waitTime = retryAfter ? parseInt(retryAfter) : 60
          setCooldown(waitTime)
          setError(`Rate limited. Please wait ${waitTime} seconds before requesting another code.`)
        } else if (res.status === 404) {
          // Fallback to start endpoint if resend doesn't exist
          const fallbackRes = await apiFetch('/v1/auth/start', { 
            method: 'POST', 
            body: JSON.stringify({ email: rawEmail }) 
          })
          if (fallbackRes.ok) {
            setSuccess('New code sent successfully!')
            setResendAttempts(prev => prev + 1)
            // Progressive cooldown: 30s, 60s, 120s
            const cooldownTime = Math.min(30 * Math.pow(2, resendAttempts), 120)
            setCooldown(cooldownTime)
          } else {
            setError('Failed to resend code. Please try again.')
          }
        } else {
          setError('Failed to resend code. Please try again.')
        }
        return
      }
      
      setResendAttempts(prev => prev + 1)
      // Progressive cooldown: 30s, 60s, 120s
      const cooldownTime = Math.min(30 * Math.pow(2, resendAttempts), 120)
      setCooldown(cooldownTime)
      
      // Clear any previous errors
      setError(null)
      
    } catch (e: any) {
      setError('Network error. Please check your connection and try again.')
    } finally {
      setResendLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && code.length === 6) {
      submit(e as any)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center p-6">
        <div className="text-left">
          <h1 className="text-2xl font-bold text-white mb-1">Enter Code</h1>
          <p className="text-gray-400 text-sm">We sent a verification code to</p>
          <p className="text-blue-400 font-medium">{emailMasked}</p>
        </div>
        <button
          onClick={handleCancel}
          disabled={isNavigating}
          className="text-gray-400 hover:text-white transition-colors p-3 rounded-full hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Cancel"
          type="button"
        >
          {isNavigating ? (
            <svg className="animate-spin w-6 h-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
        </button>
      </div>

              {/* Main Content */}
        <div className="flex-1 flex flex-col justify-center px-6 pb-6">
          {/* Error Message - Minimal */}
          {error && (
            <div className="mb-4 text-center">
              <div className="inline-flex items-center px-3 py-2 rounded-full bg-red-900/30 border border-red-600/50 text-red-300 text-sm">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </div>
            </div>
          )}
          
          {/* OTP Input Form */}
          <form onSubmit={submit} className="space-y-8">
          <div className="space-y-6">
            <div className="text-center">
              <label htmlFor="otp-input" className="text-lg font-medium text-gray-300 mb-4 block">
                Enter the 6-digit code
              </label>
            </div>
            
            <div className="relative">
              <input
                ref={inputRef}
                id="otp-input"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                onKeyDown={handleKeyDown}
                className="w-full bg-gray-800/50 backdrop-blur-sm border-2 border-gray-600 rounded-2xl px-8 py-6 text-white tracking-[0.5em] text-center text-2xl font-mono placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/20 transition-all duration-300 hover:border-gray-500"
                disabled={loading}
              />
              <div className="absolute inset-0 pointer-events-none rounded-2xl border-2 border-transparent bg-gradient-to-r from-blue-500/0 via-blue-500/20 to-blue-500/0 opacity-0 transition-opacity duration-300 focus-within:opacity-100"></div>
            </div>
          </div>

          {/* Verify Button */}
          <button 
            disabled={loading || code.length !== 6 || attempts >= maxAttempts} 
            className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-semibold py-5 px-8 rounded-2xl transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-blue-500/30 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-xl"
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Verifying...
              </span>
            ) : (
              'Verify Code'
            )}
          </button>
        </form>

        {/* Action Buttons */}
        <div className="space-y-6 mt-8">
          {/* Resend Button */}
          <div className="text-center">
            <button 
              onClick={resend} 
              disabled={cooldown > 0 || resendLoading || resendAttempts >= maxResendAttempts} 
              className="text-blue-400 hover:text-blue-300 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors font-medium text-base hover:underline"
            >
              {resendLoading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Sending...
                </span>
              ) : cooldown > 0 ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {formatTime(cooldown)}
                </span>
              ) : (
                'Resend Code'
              )}
            </button>
          </div>

          {/* Back Button */}
          <div className="text-center">
                      <button
            onClick={handleBack}
            disabled={isNavigating}
            className="text-gray-400 hover:text-gray-300 transition-colors font-medium text-base hover:underline flex items-center justify-center mx-auto disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isNavigating ? (
              <svg className="animate-spin w-4 h-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            )}
            {isNavigating ? 'Going back...' : 'Back to Email'}
          </button>
          </div>
        </div>
      </div>
    </div>
  )
}


