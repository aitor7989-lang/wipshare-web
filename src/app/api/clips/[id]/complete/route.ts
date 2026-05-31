import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { clips } from '@/lib/schema';
import { ok, err } from '@/lib/api-response';
import { requireBearerToken } from '@/lib/auth';
import { rateLimit } from '@/lib/ratelimit';
import { headObject } from '@/lib/r2';
import { env } from '@/lib/env';
import { isValidClipId } from '@/lib/ids';

export const runtime = 'nodejs';

type Params = { id: string };

export async function POST(
  req: Request,
  { params }: { params: Promise<Params> },
): Promise<Response> {
  const authError = requireBearerToken(req);
  if (authError !== null) return authError;

  const limit = rateLimit(req, 30, 60_000);
  if (!limit.ok) {
    return err(
      'rate_limited',
      `try again in ${limit.retryAfterSeconds ?? 60}s`,
      429,
      { headers: { 'Retry-After': String(limit.retryAfterSeconds ?? 60) } },
    );
  }

  const { id } = await params;
  if (!isValidClipId(id)) {
    return err('not_found', 'clip not found', 404);
  }

  let row:
    | { id: string; status: string; r2Key: string; sizeBytes: number | null; thumbR2Key: string | null }
    | undefined;
  try {
    const rows = await db
      .select({
        id: clips.id,
        status: clips.status,
        r2Key: clips.r2Key,
        sizeBytes: clips.sizeBytes,
        thumbR2Key: clips.thumbR2Key,
      })
      .from(clips)
      .where(eq(clips.id, id))
      .limit(1);
    row = rows[0];
  } catch (e) {
    console.error('[complete] db select failed id=%s err=%s', id, errorMessage(e));
    return err('db_error', 'failed to fetch clip', 500);
  }

  if (!row) return err('not_found', 'clip not found', 404);
  if (row.status !== 'pending') {
    return err('invalid_state', 'clip is not pending', 409);
  }

  const head = await headObject(row.r2Key);
  if (head === null || head.contentLength === 0) {
    try {
      await db.update(clips).set({ status: 'failed' }).where(eq(clips.id, id));
    } catch (e) {
      console.error('[complete] failed-update failed id=%s err=%s', id, errorMessage(e));
    }
    console.warn('[complete] upload missing id=%s', id);
    return err('upload_not_found', 'object not present in storage', 502);
  }

  const updates: { status: 'ready'; sizeBytes?: number; thumbR2Key?: string | null } = {
    status: 'ready',
  };
  if (head.contentLength !== row.sizeBytes) {
    updates.sizeBytes = head.contentLength;
  }

  // Best-effort thumbnail: if we expected one, confirm it actually landed.
  // A missing thumbnail must NOT fail the clip — we just clear the key so the
  // viewer falls back to the static OG image.
  if (row.thumbR2Key !== null) {
    const thumbHead = await headObject(row.thumbR2Key);
    if (thumbHead === null || thumbHead.contentLength === 0) {
      updates.thumbR2Key = null;
      console.warn('[complete] thumbnail missing, clearing id=%s', id);
    }
  }

  try {
    await db.update(clips).set(updates).where(eq(clips.id, id));
  } catch (e) {
    console.error('[complete] ready-update failed id=%s err=%s', id, errorMessage(e));
    return err('db_error', 'failed to mark clip ready', 500);
  }

  console.log('[complete] ready id=%s size=%d thumb=%s', id, head.contentLength, updates.thumbR2Key === null ? 'cleared' : (row.thumbR2Key !== null ? 'kept' : 'none'));

  return ok({
    id,
    status: 'ready' as const,
    viewerUrl: `${env.NEXT_PUBLIC_BASE_URL}/c/${id}`,
  });
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
