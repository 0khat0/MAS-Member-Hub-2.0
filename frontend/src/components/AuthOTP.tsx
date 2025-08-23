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
  
  const inputRef = useRef<HTMLInputElement>(null)

  // Show initial success message when component mounts
  useEffect(() => {
    setSuccess('Verification code sent! Check your email.')
    // Auto-clear success message after 5 seconds
    const timer = setTimeout(() => setSuccess(null), 5000)
    return () => clearTimeout(timer)
  }, [])

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
      onCancel()
    } else {
      console.error('onCancel is not a function:', onCancel)
    }
  }

  // Handle back navigation
  const handleBack = () => {
    if (typeof onBack === 'function') {
      onBack()
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
      
      setSuccess('New code sent successfully!')
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
    <div className="space-y-4">
      {/* Header with email and close button */}
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="text-sm text-gray-300">We sent a code to</div>
          <div className="text-sm font-medium text-white">{emailMasked}</div>
        </div>
        <button
          onClick={handleCancel}
          className="text-gray-400 hover:text-white transition-colors p-2 rounded hover:bg-gray-700 ml-3"
          title="Cancel authentication"
          type="button"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="bg-green-900/50 border border-green-600 text-green-300 px-3 py-2 rounded text-sm">
          {success}
        </div>
      )}
      
      {error && (
        <div className="bg-red-900/50 border border-red-600 text-red-300 px-3 py-2 rounded text-sm">
          {error}
        </div>
      )}

      {/* OTP Input Form */}
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="otp-input" className="text-sm font-medium text-gray-300">
            6-digit verification code
          </label>
          <input
            ref={inputRef}
            id="otp-input"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            placeholder="Enter 6-digit code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            onKeyDown={handleKeyDown}
            className="w-full rounded-lg px-4 py-3 text-black tracking-widest text-center text-lg font-mono border-2 border-gray-300 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-all duration-200"
            disabled={loading}
          />
        </div>

        {/* Attempt Counter */}
        {attempts > 0 && (
          <div className="text-xs text-gray-400 text-center">
            {attempts} of {maxAttempts} attempts used
          </div>
        )}

        {/* Verify Button */}
        <button 
          disabled={loading || code.length !== 6 || attempts >= maxAttempts} 
          className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
        >
          {loading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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

      {/* Resend Section */}
      <div className="space-y-3">
        <div className="text-center">
          <button 
            onClick={resend} 
            disabled={cooldown > 0 || resendLoading || resendAttempts >= maxResendAttempts} 
            className="text-sm text-blue-400 hover:text-blue-300 disabled:text-gray-500 disabled:cursor-not-allowed underline transition-colors"
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
              'Resend code'
            )}
          </button>
        </div>

        {/* Resend Attempt Counter */}
        {resendAttempts > 0 && (
          <div className="text-xs text-gray-400 text-center">
            {resendAttempts} of {maxResendAttempts} resend attempts used
          </div>
        )}

        {/* Back Button */}
        <div className="text-center">
          <button
            onClick={handleBack}
            className="text-sm text-gray-400 hover:text-gray-300 underline transition-colors"
          >
            ← Back to email
          </button>
        </div>
      </div>
    </div>
  )
}


