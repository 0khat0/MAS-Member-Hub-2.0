import { useEffect, useState } from 'react'
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
  const [cooldown, setCooldown] = useState(0)
  const [error, setError] = useState<string | null>(null)

  // Create a local cancel handler to ensure it's always a function
  const handleCancel = () => {
    console.log('Cancel handler called')
    console.log('onCancel type:', typeof onCancel)
    console.log('onCancel value:', onCancel)
    if (typeof onCancel === 'function') {
      onCancel()
    } else {
      console.error('onCancel is not a function:', onCancel)
    }
  }

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
      // Use the appropriate endpoint based on whether this is sign-in or registration
      const endpoint = isSignIn ? '/v1/auth/signin' : '/v1/auth/start'
      const res = await apiFetch(endpoint, { method: 'POST', body: JSON.stringify({ email: rawEmail }) })
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
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            console.log('Close button clicked - cancelling auth')
            handleCancel()
          }}
          className="text-gray-400 hover:text-white transition-colors p-3 rounded hover:bg-gray-700 z-10 relative cursor-pointer border border-gray-600 hover:border-gray-400"
          title="Cancel authentication"
          type="button"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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


