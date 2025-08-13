import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/session'
import { cache, getCache, setCache } from '../lib/cache'

type Member = { id: string; name: string; household_code?: string }

type Props = {
  onSelect: (member: Member) => void
}

export default function FamilySwitch({ onSelect }: Props) {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const key = 'me:household'
    const cached = getCache<any>(key)
    if (cached) {
      setMembers(cached.members || [])
      setLoading(false)
      return
    }

    // Add timeout to prevent infinite loading on mobile
    const timeoutId = setTimeout(() => {
      setLoading(false)
      setError('Loading timeout - please refresh')
    }, 10000) // 10 second timeout

    apiFetch('/v1/households/me').then(async (r) => {
      clearTimeout(timeoutId)
      if (!r.ok) {
        // Don't show error for 401 - user might just not be logged in yet
        if (r.status !== 401) {
          setError(`Failed to load: ${r.status}`)
        }
        setLoading(false)
        return
      }
      try {
        const data = await r.json()
        setMembers(data.members || [])
        setCache(key, data, 60_000)
        setError(null)
      } catch (e) {
        setError('Failed to parse response')
      } finally {
        setLoading(false)
      }
    }).catch((e) => {
      clearTimeout(timeoutId)
      console.error('FamilySwitch API error:', e)
      // Only show error for network issues, not auth issues
      if (e.message !== 'Request timeout') {
        setError('Network error - please check connection')
      }
      setLoading(false)
    })

    return () => clearTimeout(timeoutId)
  }, [])

  if (loading) return null
  if (error) return <div className="text-sm text-red-400">Error: {error}</div>
  if (!members.length) {
    // Get household code from localStorage or show generic message
    const householdCode = localStorage.getItem('household_code') || 'N/A'
    return (
      <div className="text-sm text-gray-400">
        Account #{householdCode} • No family members added yet
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {members.map((m) => (
        <button key={m.id} onClick={() => onSelect(m)} className="w-full text-left px-3 py-2 rounded bg-gray-800 hover:bg-gray-700">
          <div className="font-medium">{m.name}</div>
          <div className="text-xs text-gray-400">ID: {m.id.slice(0, 8)}...</div>
        </button>
      ))}
    </div>
  )
}


