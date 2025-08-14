import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/session'
import AuthOTP from './AuthOTP'
import { afterOtpVerified } from '../lib/afterOtpVerified'
import { handleNameInputChange } from '../utils/nameUtils';

export default function InlineAuthGate() {
  const [show, setShow] = useState(false)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [emailMasked, setEmailMasked] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const check = async () => {
      try {
        const r = await apiFetch('/v1/households/me')
        if (!r.ok) setShow(true)
      } catch {
        setShow(true)
      }
    }
    check()
  }, [])

  const start = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await apiFetch('/v1/auth/start', { method: 'POST', body: JSON.stringify({ email }) })
      if (!res.ok) throw new Error('fail')
      const data = await res.json()
      setPendingId(data.pendingId)
      setEmailMasked(data.to)
    } catch {
      setError('Failed to start. Please try again in a moment.')
    } finally {
      setLoading(false)
    }
  }

  const afterVerify = async (_payload: any) => {
    try {
      if (name.trim()) {
        await apiFetch('/v1/households/members', {
          method: 'POST',
          body: JSON.stringify({ name: name.trim() })
        })
      }
    } catch {}
    // Use afterOtpVerified to handle iOS PWA cookie race condition
    await afterOtpVerified(() => {
      window.location.href = '/profile'
    })
  }

  if (!show) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-sm rounded-lg bg-gray-900 border border-gray-700 p-5 text-white shadow-xl">
        {!pendingId ? (
          <form onSubmit={start} className="space-y-3">
            <h2 className="text-lg font-semibold text-center">Create account</h2>
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
            {error && <div className="text-red-400 text-sm">{error}</div>}
            <div className="flex gap-2">
              <button disabled={loading || !email} className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded px-4 py-2">
                {loading ? 'Sending…' : 'Create account'}
              </button>
            </div>
          </form>
        ) : (
          <div>
            <h2 className="text-lg font-semibold mb-2 text-center">Enter the code</h2>
            <AuthOTP pendingId={pendingId} emailMasked={emailMasked} rawEmail={email} onVerified={afterVerify} />
          </div>
        )}
      </div>
    </div>
  )
}


