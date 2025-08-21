import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/session'

type Props = {
  pendingId: string
  emailMasked: string
  rawEmail: string
  onVerified: (payload: any) => void
  onBack: () => void
}

export default function AuthOTP({ pendingId, emailMasked, rawEmail, onVerified, onBack }: Props) {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setInterval(() => setCooldown((c) => c - 1), 1000)
    return () => clearInterval(t)
  }, [cooldown])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await apiFetch('/v1/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ pendingId, code })
      })
      if (!res.ok) throw new Error(`${res.status}`)
      const data = await res.json()
      onVerified(data)
    } catch (e: any) {
      setError('Invalid or expired code.')
    } finally {
      setLoading(false)
    }
  }

  const resend = async () => {
    setError(null)
    try {
      const res = await apiFetch('/v1/auth/start', { method: 'POST', body: JSON.stringify({ email: rawEmail }) })
      if (!res.ok) {
        if (res.status === 429) setError('Please wait before requesting another code.')
        else setError('Failed to resend code.')
        return
      }
      setCooldown(60)
    } catch {
      setError('Failed to resend code.')
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-300">We sent a code to {emailMasked}</div>
        <button
          onClick={onBack}
          className="text-gray-400 hover:text-white transition-colors p-1"
          title="Go back to change email"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <form onSubmit={submit} className="space-y-3">
        <input
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          placeholder="6-digit code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          className="w-full rounded px-3 py-2 text-black tracking-widest text-center"
        />
        {error && <div className="text-red-400 text-sm">{error}</div>}
        <button disabled={loading || code.length !== 6} className="bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded px-4 py-2 w-full">
          {loading ? 'Verifying…' : 'Verify'}
        </button>
      </form>
      <button onClick={resend} disabled={cooldown > 0} className="text-sm underline disabled:opacity-50">
        {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
      </button>
    </div>
  )
}


