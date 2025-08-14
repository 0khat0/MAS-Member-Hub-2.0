import { useEffect, useState } from 'react'
import AuthOTP from './components/AuthOTP'
import { apiFetch } from './lib/session'
import { afterOtpVerified } from './lib/afterOtpVerified'
import { handleNameInputChange } from './utils/nameUtils';

export default function HomeAuth() {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [emailMasked, setEmailMasked] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [loginMethod, setLoginMethod] = useState<'email' | 'account'>('email')

  useEffect(() => {
    // Try session-based auth: if already logged in, go to profile
    const check = async () => {
      try {
        const r = await apiFetch('/v1/households/me')
        if (r.ok) {
          window.location.href = '/profile'
        }
      } catch {}
    }
    check()
  }, [])

  const start = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (loginMethod === 'account' && accountNumber.trim()) {
        // Login with account number
        const res = await apiFetch('/v1/auth/start-account', {
          method: 'POST',
          body: JSON.stringify({ accountNumber: accountNumber.trim() })
        })
        if (!res.ok) throw new Error('failed')
        const data = await res.json()
        setPendingId(data.pendingId)
        setEmailMasked(data.to)
      } else {
        // Login with email
        const res = await apiFetch('/v1/auth/start', {
          method: 'POST',
          body: JSON.stringify({ email })
        })
        if (!res.ok) throw new Error('failed')
        const data = await res.json()
        setPendingId(data.pendingId)
        setEmailMasked(data.to)
      }
    } catch {
      setError('Failed to start. Please try again in a moment.')
    } finally {
      setLoading(false)
    }
  }

  const afterVerify = async (_payload: any) => {
    try {
      // If user provided a name, create initial member
      let firstId: string | null = null
      if (name.trim().length > 0) {
        const r = await apiFetch('/v1/households/members', {
          method: 'POST',
          body: JSON.stringify({ name: name.trim() })
        })
        if (r.ok) {
          const m = await r.json()
          firstId = m?.id ?? null
        }
      }
      if (firstId) localStorage.setItem('member_id', firstId)
      // Use afterOtpVerified to handle iOS PWA cookie race condition
      await afterOtpVerified(() => {
        window.location.href = firstId ? `/profile?id=${firstId}` : '/profile'
      })
    } catch {
      // Use afterOtpVerified even on error to ensure proper session handling
      await afterOtpVerified(() => {
        window.location.href = '/profile'
      })
    }
  }

  if (pendingId) {
    return (
      <div className="max-w-sm mx-auto p-4 space-y-3">
        <h2 className="text-xl font-semibold">Enter the code</h2>
        <AuthOTP pendingId={pendingId} emailMasked={emailMasked} rawEmail={email} onVerified={afterVerify} />
      </div>
    )
  }

  return (
    <div className="max-w-sm mx-auto p-4 space-y-4">
      <h2 className="text-xl font-semibold text-center">Sign In / Create Account</h2>
      
      {/* Login Method Toggle */}
      <div className="flex rounded-lg bg-gray-200 p-1">
        <button
          type="button"
          onClick={() => setLoginMethod('email')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            loginMethod === 'email' 
              ? 'bg-white text-gray-900 shadow-sm' 
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Email
        </button>
        <button
          type="button"
          onClick={() => setLoginMethod('account')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            loginMethod === 'account' 
              ? 'bg-white text-gray-900 shadow-sm' 
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Account #
        </button>
      </div>

      <form onSubmit={start} className="space-y-3">
        {loginMethod === 'email' ? (
          <>
            <input
              type="text"
              placeholder="Member name (optional)"
              value={name}
              onChange={(e) => handleNameInputChange(e, setName)}
              className="w-full rounded px-3 py-2 text-black"
            />
            <input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded px-3 py-2 text-black"
            />
          </>
        ) : (
          <input
            type="text"
            placeholder="Enter your 5-character account number"
            value={accountNumber}
            onChange={(e) => {
              const value = e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 5);
              setAccountNumber(value);
            }}
            maxLength={5}
            className="w-full rounded px-3 py-2 text-black text-center tracking-widest font-mono"
            required
          />
        )}
        
        {error && <div className="text-red-400 text-sm">{error}</div>}
        <button 
          disabled={loading || (loginMethod === 'email' ? !email : !accountNumber.trim())} 
          className="bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded px-4 py-2 w-full"
        >
          {loading ? 'Sending…' : (loginMethod === 'email' ? 'Create account' : 'Sign in')}
        </button>
      </form>
    </div>
  )
}


