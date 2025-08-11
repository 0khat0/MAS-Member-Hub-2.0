import { useEffect, useState, useRef } from 'react'
import { getCache, setCache } from '../lib/cache'

interface Member { id: string; name: string; email: string }

export function useFamily(email: string | null) {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState<boolean>(!!email)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!email) return

    const key = `family:${email}`
    const cached = getCache<Member[]>(key)
    if (cached) {
      setMembers(cached)
      setLoading(false)
      // Refresh in background
      fetchFamily(email, key, setMembers, abortRef)
      return
    }

    setLoading(true)
    fetchFamily(email, key, setMembers, abortRef)

    return () => {
      abortRef.current?.abort()
    }
  }, [email])

  return { members, loading }
}

async function fetchFamily(
  email: string,
  key: string,
  setMembers: (m: any[]) => void,
  abortRef: React.MutableRefObject<AbortController | null>
) {
  try {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'
    const res = await fetch(`${API_URL}/family/members/${encodeURIComponent(email)}`, {
      signal: ctrl.signal,
    })
    if (!res.ok) return
    const data = await res.json()
    setMembers(data)
    setCache(key, data, 60_000)
  } catch {
    // ignore
  }
}


