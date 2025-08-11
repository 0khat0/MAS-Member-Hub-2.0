import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/session'
import { cache, getCache, setCache } from '../lib/cache'

type Member = { id: string; name: string; member_code: string }

type Props = {
  onSelect: (member: Member) => void
}

export default function FamilySwitch({ onSelect }: Props) {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const key = 'me:household'
    const cached = getCache<any>(key)
    if (cached) {
      setMembers(cached.members || [])
      setLoading(false)
    }
    apiFetch('/v1/households/me').then(async (r) => {
      if (!r.ok) return
      const data = await r.json()
      setMembers(data.members || [])
      setCache(key, data, 60_000)
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="text-sm text-gray-400">Loading family…</div>
  if (!members.length) return <div className="text-sm text-gray-400">No members yet.</div>

  return (
    <div className="space-y-2">
      {members.map((m) => (
        <button key={m.id} onClick={() => onSelect(m)} className="w-full text-left px-3 py-2 rounded bg-gray-800 hover:bg-gray-700">
          <div className="font-medium">{m.name}</div>
          <div className="text-xs text-gray-400">Code: {m.member_code}</div>
        </button>
      ))}
    </div>
  )
}


