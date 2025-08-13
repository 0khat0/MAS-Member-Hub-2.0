import { apiFetch } from './session'
import { clearAppStorage } from './storage'

/**
 * Clean logout: clears server cookie + all local caches, then cold-starts the app.
 *
 * Usage: await logout();
 */
export async function logout() {
  try {
    await apiFetch("/v1/auth/logout", { method: "POST" });
  } catch {
    // ignore network errors on logout
  }
  clearAppStorage();
  location.assign("/"); // cold start without any stale state
}
