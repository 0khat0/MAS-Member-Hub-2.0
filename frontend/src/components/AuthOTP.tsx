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
    <div className="flex flex-col">
      {/* Header removed per user request to avoid top clutter */}
      {/* Main Content - keep compact; rely on parent container sizing */}
      <div className="px-4 sm:px-6 py-4">
           {/* Error Message - Mobile Optimized */}
           {error && (
             <div className="mb-3 sm:mb-4 text-center">
               <div className="inline-flex items-center px-3 py-2 rounded-full bg-red-900/30 border border-red-600/50 text-red-300 text-xs sm:text-sm max-w-full">
                 <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                 </svg>
                 <span className="break-words">{error}</span>
               </div>
             </div>
           )}
           
          {/* Info block (replaces header) */}
          <div className="text-center mb-4 sm:mb-6">
            <p className="text-gray-400 text-xs sm:text-sm">We sent a verification code to</p>
            <p className="text-blue-400 font-medium text-sm sm:text-base break-all">{emailMasked}</p>
            <p className="mt-2 text-[11px] sm:text-xs text-gray-400">
              Don’t see the code? Check your junk/spam folder.
            </p>
          </div>

          {/* Small spinner while an action is in progress */}
          {(loading || resendLoading) && (
            <div className="flex justify-center mb-3" aria-live="polite" aria-busy="true">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          
           {/* OTP Input Form - Mobile Optimized */}
           <form onSubmit={submit} className="space-y-4 sm:space-y-6">
           <div className="space-y-4">
             <div className="text-center">
               <label htmlFor="otp-input" className="text-base sm:text-lg font-medium text-gray-300 block">
                 Enter the 6-digit code
               </label>
             </div>
             
             <div className="w-full flex justify-center">
               <div className="w-full max-w-[320px]">
                 <input
                   ref={inputRef}
                   id="otp-input"
                   inputMode="numeric"
                   pattern="[0-9]*"
                   maxLength={6}
                   placeholder=""
                   value={code}
                   onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                   onKeyDown={handleKeyDown}
                   className="w-full bg-gray-800/60 border border-gray-600 rounded-xl px-4 py-3 text-white text-center text-2xl sm:text-3xl font-mono tracking-normal focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all duration-200"
                   disabled={loading}
                   autoComplete="one-time-code"
                   autoCorrect="off"
                   autoCapitalize="off"
                   spellCheck="false"
                 />
               </div>
             </div>
           </div>

          {/* Verify Button - Mobile Optimized */}
          <button 
            disabled={loading || code.length !== 6 || attempts >= maxAttempts} 
            className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-semibold py-4 sm:py-5 px-6 sm:px-8 rounded-2xl transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-blue-500/30 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-xl touch-manipulation min-h-[56px] sm:min-h-[64px]"
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-4 w-4 sm:h-5 sm:w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-sm sm:text-base">Verifying...</span>
              </span>
            ) : (
              <span className="text-sm sm:text-base">Verify Code</span>
            )}
          </button>
        </form>

        {/* Action Buttons - Mobile Optimized */}
        <div className="space-y-4 sm:space-y-6 mt-6 sm:mt-8">
          {/* Resend Button - Mobile Optimized */}
          <div className="text-center">
            <button 
              onClick={resend} 
              disabled={cooldown > 0 || resendLoading || resendAttempts >= maxResendAttempts} 
              className="text-blue-400 hover:text-blue-300 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors font-medium text-sm sm:text-base hover:underline touch-manipulation py-2 px-4 rounded-lg hover:bg-blue-900/20 disabled:hover:bg-transparent"
            >
              {resendLoading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-2 h-3 w-3 sm:h-4 sm:w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="text-sm sm:text-base">Sending...</span>
                </span>
              ) : cooldown > 0 ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-2 h-3 w-3 sm:h-4 sm:w-4 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="text-sm sm:text-base">{formatTime(cooldown)}</span>
                </span>
              ) : (
                <span className="text-sm sm:text-base">Resend Code</span>
              )}
            </button>
          </div>

          {/* Back Button - Mobile Optimized */}
          <div className="text-center">
            <button
              onClick={handleBack}
              disabled={isNavigating}
              className="text-gray-400 hover:text-gray-300 transition-colors font-medium text-sm sm:text-base hover:underline flex items-center justify-center mx-auto disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation py-2 px-4 rounded-lg hover:bg-gray-800/20 disabled:hover:bg-transparent"
            >
              {isNavigating ? (
                <svg className="animate-spin w-3 h-3 sm:w-4 sm:h-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              )}
              <span className="text-sm sm:text-base">{isNavigating ? 'Going back...' : 'Back to Email'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}


