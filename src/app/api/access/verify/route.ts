import { z } from 'zod';
import { ok, err } from '@/lib/api-response';
import { isValidSecret } from '@/lib/auth';
import { rateLimit } from '@/lib/ratelimit';

export const runtime = 'nodejs';

/**
 * POST /api/access/verify
 *
 * First-run check: the desktop client posts the invite code the user pasted and
 * we confirm it matches WIPSHARE_UPLOAD_SECRET (constant-time). The code IS the
 * shared upload secret in this alpha - verifying it here lets the client store
 * it (in Windows Credential Manager) and use it as the bearer token thereafter.
 *
 * Body: { code: string }
 *   200 { data: { ok: true } }              on match
 *   401 { error: { code: 'invalid_code' } } on mismatch
 *   400 { error: { code: 'invalid_request' } } on bad body
 *   429 { error: { code: 'rate_limited' } } over 10 req/IP/min
 *
 * The secret is never logged.
 */
const verifySchema = z.object({
  code: z.string().min(1).max(200),
});

export async function POST(req: Request): Promise<Response> {
  // Rate-limit first so a bad actor can't brute-force the code: 10/IP/min.
  const limit = rateLimit(req, 10, 60_000);
  if (!limit.ok) {
    return err(
      'rate_limited',
      `try again in ${limit.retryAfterSeconds ?? 60}s`,
      429,
      { headers: { 'Retry-After': String(limit.retryAfterSeconds ?? 60) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return err('invalid_request', 'body is not valid JSON', 400);
  }

  const parsed = verifySchema.safeParse(body);
  if (!parsed.success) {
    return err('invalid_request', 'expected a non-empty "code" string', 400);
  }

  if (!isValidSecret(parsed.data.code)) {
    // Never echo the attempted code.
    console.log('[access/verify] rejected an invite code');
    return err('invalid_code', "that code didn't work", 401);
  }

  console.log('[access/verify] accepted an invite code');
  return ok({ ok: true });
}
