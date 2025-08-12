const COOKIE_NAME = 'mh_session'

export function getSessionToken(): string | null {
  const m = document.cookie.match(new RegExp('(?:^|; )' + COOKIE_NAME + '=([^;]*)'))
  return m ? decodeURIComponent(m[1]) : null
}

export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const base = (import.meta as any).env?.VITE_API_URL?.replace(/\/$/, '') || '/api'
  const path = input.startsWith('/') ? input : `/${input}`
  const url = /^https?:\/\//i.test(input) ? input : `${base}${path}`
  
  // Add timeout to prevent hanging requests on mobile
  const timeoutPromise = new Promise<Response>((_, reject) => {
    setTimeout(() => reject(new Error('Request timeout')), 20000); // 20 second timeout
  });

  const fetchPromise = fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
    ...init,
  });

  return Promise.race([fetchPromise, timeoutPromise]);
}


