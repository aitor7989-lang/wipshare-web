import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { env } from './env';

/**
 * Cookie-based device identity. The desktop app generates a random owner_token
 * (a GUID) and stamps every clip with it. The /r/[id] bridge hands that token to
 * the browser by setting a signed `wip_uid` cookie; thereafter the browser is
 * treated as the owner of any clip whose owner_token matches the cookie.
 *
 * SECURITY MODEL (alpha): owner_token is a bearer capability - whoever holds it
 * can manage that device's clips. It is signed in the cookie (so it can't be
 * forged) but it is NOT a secret password: it travels in the bridge URL
 * (/r/[id]?o=token), which is acceptable for the alpha. Real accounts land later.
 * The cookie is HMAC-signed with the existing server secret (no new env var) and
 * is httpOnly, so page scripts can never read or exfiltrate it.
 */

export const OWNER_COOKIE = 'wip_uid';

// 8 days - slightly longer than the 7-day clip TTL so a clip is still "yours"
// right up to the moment it expires.
export const OWNER_COOKIE_MAX_AGE_SECONDS = 8 * 24 * 60 * 60;

// owner_token bounds mirror the initiate route (a GUID is ~36 chars).
const MIN_TOKEN_LEN = 1;
const MAX_TOKEN_LEN = 100;

const SIGNING_KEY = env.WIPSHARE_UPLOAD_SECRET;

/** Shared Set-Cookie options for wip_uid. Secure works on https + http://localhost. */
export const ownerCookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: true,
  path: '/',
  maxAge: OWNER_COOKIE_MAX_AGE_SECONDS,
} as const;

function hmac(input: string): string {
  return createHmac('sha256', SIGNING_KEY).update(input).digest('base64url');
}

/** Encodes a token as `<base64url(token)>.<hmac>` for the cookie value. */
export function signValue(value: string): string {
  const v = Buffer.from(value, 'utf8').toString('base64url');
  return `${v}.${hmac(v)}`;
}

/** Verifies a signed cookie value (constant-time); returns the token or null. */
export function verifySignedValue(signed: string | undefined): string | null {
  if (!signed) return null;
  const dot = signed.lastIndexOf('.');
  if (dot <= 0) return null;
  const v = signed.slice(0, dot);
  const provided = Buffer.from(signed.slice(dot + 1));
  const expected = Buffer.from(hmac(v));
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;
  let token: string;
  try {
    token = Buffer.from(v, 'base64url').toString('utf8');
  } catch {
    return null;
  }
  return isPlausibleToken(token) ? token : null;
}

export function isPlausibleToken(token: string): boolean {
  return token.length >= MIN_TOKEN_LEN && token.length <= MAX_TOKEN_LEN;
}

/**
 * Reads + verifies the wip_uid cookie and returns the owner_token, or null when
 * absent/tampered. Use this for every ownership check (viewer branch, library
 * scope, rename/delete authorization) - never trust an owner identity from the
 * client request body or query.
 */
export async function getOwnerToken(): Promise<string | null> {
  const store = await cookies();
  return verifySignedValue(store.get(OWNER_COOKIE)?.value);
}
