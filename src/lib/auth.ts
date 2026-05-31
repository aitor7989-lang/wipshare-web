import { timingSafeEqual } from 'node:crypto';
import { env } from './env';
import { err } from './api-response';

const BEARER_PREFIX = 'Bearer ';
const expectedBytes = Buffer.from(env.WIPSHARE_UPLOAD_SECRET, 'utf8');

/**
 * Constant-time check of an arbitrary string against WIPSHARE_UPLOAD_SECRET.
 * timingSafeEqual throws on length mismatch, so we guard length first (a length
 * mismatch is itself just "wrong secret"). Never logs the secret or the input.
 */
export function isValidSecret(provided: string): boolean {
  const providedBytes = Buffer.from(provided, 'utf8');
  if (providedBytes.length !== expectedBytes.length) return false;
  return timingSafeEqual(providedBytes, expectedBytes);
}

/**
 * Validates the Authorization header against WIPSHARE_UPLOAD_SECRET using a
 * constant-time compare. Returns a 401 Response on failure, null on success.
 *
 * SECURITY NOTE: this is a SPEED BUMP, not real auth. Single shared secret,
 * no rotation, no per-user identity, no audit trail. Real auth (accounts +
 * magic-link / OAuth) lands in Phase 2C. The secret is enough to keep this
 * endpoint from being trivially abused by anyone who finds the URL; that's
 * the entire threat model for the alpha.
 */
export function requireBearerToken(req: Request): Response | null {
  const header = req.headers.get('authorization');
  if (header === null || !header.startsWith(BEARER_PREFIX)) {
    return err('unauthorized', 'missing or invalid bearer token', 401);
  }
  if (!isValidSecret(header.slice(BEARER_PREFIX.length))) {
    return err('unauthorized', 'missing or invalid bearer token', 401);
  }
  return null;
}
