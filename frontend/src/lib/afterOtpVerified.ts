import { getSessionOptional } from './session'

/**
 * Call this immediately after OTP verify succeeds, before navigating.
 * It retries session read briefly to avoid iOS PWA cookie write delays.
 *
 * Example:
 *   await afterOtpVerified(() => navigate('/profile'));
 */
export async function afterOtpVerified(navigate: () => void) {
  for (let i = 0; i < 3; i++) {
    const s = await getSessionOptional(1200);
    if (s) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  navigate(); // use your router; avoid window.location.replace
}
