import { useState } from 'react'
import { apiFetch } from '../lib/session'
import { maskEmail } from '../lib/email'

type Props = {
  onPending: (pendingId: string, emailMasked: string, rawEmail: string) => void
  onSignIn?: () => void
  isSignIn: boolean
  onImmediate?: (payload: any) => void
}

export default function AuthEmail({ onPending, onSignIn, isSignIn, onImmediate }: Props) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const endpoint = isSignIn ? '/v1/auth/signin' : '/v1/auth/start'
      const res = await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify({ email })
      })
      if (!res.ok) {
        if (res.status === 409) {
          setError('An account with this email already exists. Please sign in instead.')
        } else if (res.status === 404) {
          setError('No account found with this email. Please register first.')
        } else {
          throw new Error(`${res.status}`)
        }
        return
      }
      const data = await res.json()

      // When OTP is disabled, backend returns full profile immediately
      if (data && data.ok) {
        onImmediate?.(data)
        return
      }

      onPending(data.pendingId, data.to, email.trim().toLowerCase())
    } catch (e: any) {
      setError('Failed to start. Please try again in a moment.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <input
        type="email"
        placeholder="your@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        className="w-full rounded px-3 py-2 text-black"
      />
      {error && (
        <div className="space-y-2">
          <div className="text-red-400 text-sm">{error}</div>
          {error.includes('already exists') && !isSignIn && (
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="text-blue-400 hover:text-blue-300 text-sm underline"
            >
              Sign in instead
            </button>
          )}
          {error.includes('No account found') && isSignIn && (
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="text-red-400 hover:text-red-300 text-sm underline"
            >
              Register instead
            </button>
          )}
        </div>
      )}
      <button disabled={loading} className={`w-full rounded px-4 py-2 disabled:opacity-50 ${
        isSignIn 
          ? 'bg-blue-600 hover:bg-blue-700' 
          : 'bg-red-600 hover:bg-red-700'
      }`}>
        {loading ? 'Sending…' : (isSignIn ? 'Send sign-in code' : 'Send verification code')}
      </button>
    </form>
  )
}


