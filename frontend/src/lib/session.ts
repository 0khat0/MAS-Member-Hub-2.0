const COOKIE_NAME = 'mh_session'

export function getSessionToken(): string | null {
  const m = document.cookie.match(new RegExp('(?:^|; )' + COOKIE_NAME + '=([^;]*)'))
  return m ? decodeURIComponent(m[1]) : null
}

export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const url = input.startsWith('/api') ? input : `/api${input.startsWith('/') ? '' : '/'}${input}`
  return fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
    ...init,
  })
}


