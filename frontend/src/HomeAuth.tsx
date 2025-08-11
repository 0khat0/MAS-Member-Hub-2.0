import { useEffect, useState } from 'react'
import AuthOTP from './components/AuthOTP'
import { apiFetch } from './lib/session'

export default function HomeAuth() {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [emailMasked, setEmailMasked] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

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
      const res = await apiFetch('/v1/auth/start', {
        method: 'POST',
        body: JSON.stringify({ email })
      })
      if (!res.ok) throw new Error('failed')
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
      window.location.href = firstId ? `/profile?id=${firstId}` : '/profile'
    } catch {
      window.location.href = '/profile'
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
      <h2 className="text-xl font-semibold text-center">Create account</h2>
      <form onSubmit={start} className="space-y-3">
        <input
          type="text"
          placeholder="Member name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
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
        <button disabled={loading || !email} className="bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded px-4 py-2 w-full">
          {loading ? 'Sending…' : 'Create account'}
        </button>
      </form>
    </div>
  )
}


