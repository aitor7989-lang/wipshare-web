import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/**
 * Clip view-passwords. Hashed with scrypt (memory-hard) and a per-password
 * random salt, stored as `salt:hash` (both hex). This is deliberately NOT the
 * HMAC used for cookie signing: a password is a low-entropy human secret, so it
 * needs a slow, salted KDF — not a fast keyed hash.
 *
 * scryptSync blocks briefly (~tens of ms) which is fine for the low-traffic,
 * rate-limited /unlock path. The stored hash never leaves the server.
 */

const SALT_BYTES = 16;
const KEY_LEN = 64;

/** Hashes a password as `salt:hash` (hex), with a fresh 16-byte salt. */
export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_BYTES);
  const hash = scryptSync(password, salt, KEY_LEN);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

/**
 * Verifies a password against a stored `salt:hash`, constant-time. Returns false
 * for any malformed stored value rather than throwing.
 */
export function verifyPassword(password: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  const sep = stored.indexOf(':');
  if (sep <= 0) return false;

  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(stored.slice(0, sep), 'hex');
    expected = Buffer.from(stored.slice(sep + 1), 'hex');
  } catch {
    return false;
  }
  if (salt.length === 0 || expected.length === 0) return false;

  let actual: Buffer;
  try {
    actual = scryptSync(password, salt, expected.length);
  } catch {
    return false;
  }
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
