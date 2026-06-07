/**
 * In-memory sliding-window rate limiter, keyed by client IP.
 *
 * LIMITATION: per-function-instance only. Vercel serverless functions are
 * short-lived and don't share memory across concurrent invocations, so the
 * effective limit per IP is `limit × concurrent_instances` and the window
 * resets on every cold start. That's acceptable for Phase 2A - the upload
 * secret is the primary defense; this is a small extra speed bump against
 * trivial scripted abuse. A production-grade limiter would back this with
 * Upstash / Vercel KV / Redis. Out of scope here.
 */

const buckets = new Map<string, number[]>();

export type RateLimitResult = {
  ok: boolean;
  retryAfterSeconds?: number;
};

export function rateLimit(
  req: Request,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const now = Date.now();
  const cutoff = now - windowMs;

  const timestamps = buckets.get(ip) ?? [];
  const recent = timestamps.filter((t) => t > cutoff);

  if (recent.length >= limit) {
    const oldest = recent[0];
    // Length check above guarantees oldest is defined, but noUncheckedIndexedAccess
    // can't see that. Treat the impossible-undefined case as "allow" - safer than
    // an unreachable throw.
    if (oldest === undefined) return { ok: true };
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    return { ok: false, retryAfterSeconds };
  }

  recent.push(now);
  buckets.set(ip, recent);
  return { ok: true };
}
