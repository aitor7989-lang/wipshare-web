import { getOwnerToken } from './identity';
import { hasViewGrant } from './view-grant';

export type ClipAccessInput = {
  ownerToken: string | null;
  visibility: string;
  passwordHash: string | null;
};

/**
 * Single source of truth for "may this request read the clip's bytes" — used by
 * both /stream and /download so they can never drift. Returns true to allow,
 * false to deny (403). Not-ready (404) and expiry (410) are checked separately
 * by the caller.
 *
 * Authorization is never trusted from the client: ownership comes from the
 * signed wip_uid cookie, the password grant from the signed wip_view_<id> cookie.
 *
 *   - owner (cookie matches owner_token) → allow, regardless of visibility
 *   - private + non-owner                → deny
 *   - public + no password               → allow (current behavior)
 *   - public + password                  → allow only with a valid view grant
 */
export async function canReadClipBytes(clip: ClipAccessInput, clipId: string): Promise<boolean> {
  const owner = await getOwnerToken();
  if (clip.ownerToken !== null && owner !== null && owner === clip.ownerToken) return true;
  if (clip.visibility !== 'public') return false;
  if (clip.passwordHash === null) return true;
  return hasViewGrant(clipId);
}
