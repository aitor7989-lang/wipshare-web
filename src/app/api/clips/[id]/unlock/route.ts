import { z } from 'zod';
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { clips } from '@/lib/schema';
import { err } from '@/lib/api-response';
import { isValidClipId } from '@/lib/ids';
import { rateLimit } from '@/lib/ratelimit';
import { verifyPassword } from '@/lib/password';
import { viewCookieName, viewGrantCookieOptions, viewGrantMaxAge, signViewGrant } from '@/lib/view-grant';

export const runtime = 'nodejs';

type Params = { id: string };

const unlockSchema = z.object({
  password: z.string().min(1, 'password is required').max(200, 'password is too long'),
});

/**
 * POST /api/clips/[id]/unlock  { password }
 *
 * Password gate for a public, password-protected clip. On the correct password
 * we set a short-lived, signed, httpOnly view-grant cookie scoped to this clip
 * id; the stream/download gate then releases the bytes. Rate-limited 10/IP/min
 * so the password can't be brute-forced.
 *
 *   200 { data: { ok: true } }                     correct password
 *   401 { error: { code: 'wrong_password' } }      wrong password (or no gate)
 *   400 invalid body   404 unknown/not-ready   410 expired   429 rate limited
 *
 * A clip with no password (public open, or private) returns the same 401 as a
 * wrong password, so this endpoint never reveals a clip's privacy state.
 */
export async function POST(req: Request, { params }: { params: Promise<Params> }): Promise<Response> {
  const { id } = await params;
  if (!isValidClipId(id)) return err('not_found', 'clip not found', 404);

  // Brute-force speed bump: 10 attempts / IP / minute → 429.
  const limit = rateLimit(req, 10, 60_000);
  if (!limit.ok) {
    return err('rate_limited', `try again in ${limit.retryAfterSeconds ?? 60}s`, 429, {
      headers: { 'Retry-After': String(limit.retryAfterSeconds ?? 60) },
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return err('invalid_request', 'body is not valid JSON', 400);
  }
  const parsed = unlockSchema.safeParse(body);
  if (!parsed.success) {
    return err('invalid_request', parsed.error.issues.map((i) => i.message).join('; '), 400);
  }

  let row: { status: string; visibility: string; passwordHash: string | null; expiresAt: Date | null } | undefined;
  try {
    const rows = await db
      .select({
        status: clips.status,
        visibility: clips.visibility,
        passwordHash: clips.passwordHash,
        expiresAt: clips.expiresAt,
      })
      .from(clips)
      .where(eq(clips.id, id))
      .limit(1);
    row = rows[0];
  } catch (e) {
    console.error('[unlock] db select failed id=%s err=%s', id, e instanceof Error ? e.message : String(e));
    return err('db_error', 'failed to load clip', 500);
  }

  if (!row || row.status !== 'ready') return err('not_found', 'clip not found', 404);
  if (row.expiresAt !== null && row.expiresAt.getTime() <= Date.now()) {
    return err('gone', 'this clip is no longer available', 410);
  }

  // Only a public + password clip has a gate to clear. Anything else (private,
  // or public with no password) gets the same generic rejection so the response
  // doesn't leak whether the clip is private or password-free.
  if (row.visibility !== 'public' || row.passwordHash === null || !verifyPassword(parsed.data.password, row.passwordHash)) {
    return err('wrong_password', "that password didn't work", 401);
  }

  // Correct: hand back a signed, clip-scoped, short-lived view grant. Not using
  // ok() because the envelope must ride on a NextResponse so we can set-cookie.
  const res = NextResponse.json({ data: { ok: true } });
  res.cookies.set(viewCookieName(id), signViewGrant(id), viewGrantCookieOptions(viewGrantMaxAge(row.expiresAt)));
  return res;
}
