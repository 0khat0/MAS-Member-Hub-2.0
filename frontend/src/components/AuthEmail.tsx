import { useState } from 'react'
import { apiFetch } from '../lib/session'
import { maskEmail } from '../lib/email'

type Props = {
  onPending: (pendingId: string, emailMasked: string, rawEmail: string) => void
}

export default function AuthEmail({ onPending }: Props) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await apiFetch('/v1/auth/start', {
        method: 'POST',
        body: JSON.stringify({ email })
      })
      if (!res.ok) {
        throw new Error(`${res.status}`)
      }
      const data = await res.json()
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
      {error && <div className="text-red-400 text-sm">{error}</div>}
      <button disabled={loading} className="bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded px-4 py-2">
        {loading ? 'Sending…' : 'Send code'}
      </button>
    </form>
  )
}


