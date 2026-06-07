import { cookies } from 'next/headers';
import { signValue, verifySignedValue } from './identity';

/**
 * A short-lived "this viewer cleared the password" grant for one public,
 * password-protected clip. After a correct POST /api/clips/[id]/unlock, the
 * browser carries a signed, httpOnly cookie scoped to that single clip id; the
 * stream/download gate honors it. It is NOT an ownership token — it only proves
 * the password was entered, and it can't open private clips or any other clip.
 *
 * Per-clip cookie (`wip_view_<id>`) so each grant carries its own TTL, capped at
 * the clip's remaining life and never more than a couple of hours. Signed with
 * the same server HMAC as wip_uid (no new env var); the value is the clip id, so
 * a stolen value verifies only for the clip it was issued for.
 */

// Long enough to watch and re-watch; short enough that a shared machine doesn't
// stay unlocked. The clip's own expiry caps it further (see viewGrantMaxAge).
export const VIEW_GRANT_MAX_SECONDS = 2 * 60 * 60;

export function viewCookieName(clipId: string): string {
  return `wip_view_${clipId}`;
}

export function viewGrantCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/',
    maxAge: maxAgeSeconds,
  } as const;
}

/** Grant TTL: min(2h, time until the clip expires), at least 1s. */
export function viewGrantMaxAge(expiresAt: Date | null): number {
  if (!expiresAt) return VIEW_GRANT_MAX_SECONDS;
  const remaining = Math.floor((expiresAt.getTime() - Date.now()) / 1000);
  return Math.max(1, Math.min(VIEW_GRANT_MAX_SECONDS, remaining));
}

/** The signed cookie value for a clip's view grant (the signed clip id). */
export function signViewGrant(clipId: string): string {
  return signValue(clipId);
}

/** True iff the request carries a valid, untampered view grant for this clip. */
export async function hasViewGrant(clipId: string): Promise<boolean> {
  const store = await cookies();
  return verifySignedValue(store.get(viewCookieName(clipId))?.value) === clipId;
}
