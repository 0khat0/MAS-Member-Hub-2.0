const COOKIE_NAME = 'mh_session'

// HTTPError class for better error handling
export class HTTPError extends Error {
  status: number;
  body: string;
  constructor(status: number, body: string) {
    super(`${status}:${body}`);
    this.status = status;
    this.body = body;
  }
}

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

// Session probe with timeout used at app boot and after OTP verify
export async function bootstrapSession(timeoutMs = 6000): Promise<any> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort('timeout'), timeoutMs)
  try {
    const res = await apiFetch('/v1/auth/session', { signal: ctrl.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(t)
  }
}

// New function: Try to fetch the current session. If there's no session yet (401) or we time out,
// return null silently. Only throw for real errors (5xx, unexpected).
export async function getSessionOptional(
  timeoutMs = 6000
): Promise<{ ok: boolean; householdId: string; email: string } | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await apiFetch('/v1/auth/session', { signal: ctrl.signal });
    if (!res.ok) {
      if (res.status === 401) return null; // not logged in yet
      throw new HTTPError(res.status, await res.text());
    }
    return await res.json();
  } catch (e: any) {
    if (e instanceof HTTPError && e.status === 401) return null; // not logged in yet
    if (e?.name === "AbortError") return null; // slow mobile networks on cold start
    throw e; // real errors bubble up
  } finally {
    clearTimeout(timer);
  }
}


