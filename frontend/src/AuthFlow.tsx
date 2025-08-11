import { useState } from 'react'
import AuthEmail from './components/AuthEmail'
import AuthOTP from './components/AuthOTP'
import FamilySwitch from './components/FamilySwitch'

export default function AuthFlow() {
  const [step, setStep] = useState<'email'|'otp'|'done'>('email')
  const [pendingId, setPendingId] = useState('')
  const [emailMasked, setEmailMasked] = useState('')
  const [rawEmail, setRawEmail] = useState('')
  const [me, setMe] = useState<any | null>(null)

  if (step === 'email') {
    return (
      <div className="max-w-sm mx-auto p-4">
        <h2 className="text-xl font-semibold mb-2">Sign in or Register</h2>
        <AuthEmail onPending={(pid, masked, raw) => { setPendingId(pid); setEmailMasked(masked); setRawEmail(raw); setStep('otp') }} />
      </div>
    )
  }
  if (step === 'otp') {
    return (
      <div className="max-w-sm mx-auto p-4">
        <h2 className="text-xl font-semibold mb-2">Enter code</h2>
        <AuthOTP pendingId={pendingId} emailMasked={emailMasked} rawEmail={rawEmail} onVerified={(data) => { setMe(data); setStep('done') }} />
      </div>
    )
  }
  return (
    <div className="max-w-sm mx-auto p-4 space-y-3">
      <h2 className="text-xl font-semibold">Welcome</h2>
      <div className="text-sm text-gray-400">Household: {me?.householdCode}</div>
      <FamilySwitch onSelect={(m) => { localStorage.setItem('active_member', JSON.stringify(m)); }} />
    </div>
  )
}


