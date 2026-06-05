import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { clips } from '@/lib/schema';
import { ok, err } from '@/lib/api-response';
import { getOwnerToken } from '@/lib/identity';
import { isValidClipId } from '@/lib/ids';
import { deleteObject } from '@/lib/r2';

export const runtime = 'nodejs';

type Params = { id: string };

const patchSchema = z.object({
  title: z.string().trim().min(1, 'title is required').max(200, 'title is too long'),
});

/**
 * True when the verified wip_uid cookie owns this clip. Ownership is decided
 * server-side from the signed cookie — never trusted from the request body/query.
 */
async function isOwner(clipOwnerToken: string | null): Promise<boolean> {
  if (clipOwnerToken === null) return false;
  const owner = await getOwnerToken();
  return owner !== null && owner === clipOwnerToken;
}

/** PATCH /api/clips/[id] — owner-only rename. */
export async function PATCH(req: Request, { params }: { params: Promise<Params> }): Promise<Response> {
  const { id } = await params;
  if (!isValidClipId(id)) return err('not_found', 'clip not found', 404);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return err('invalid_request', 'body is not valid JSON', 400);
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return err('invalid_request', parsed.error.issues.map((i) => i.message).join('; '), 400);
  }

  let row: { ownerToken: string | null } | undefined;
  try {
    const rows = await db
      .select({ ownerToken: clips.ownerToken })
      .from(clips)
      .where(eq(clips.id, id))
      .limit(1);
    row = rows[0];
  } catch (e) {
    console.error('[clips PATCH] db select failed id=%s err=%s', id, errorMessage(e));
    return err('db_error', 'failed to load clip', 500);
  }

  if (!row) return err('not_found', 'clip not found', 404);
  if (!(await isOwner(row.ownerToken))) return err('forbidden', 'not your clip', 403);

  // Store the title without the clip's extension; the download re-appends ".mp4".
  const title = parsed.data.title.replace(/\.mp4$/i, '').trim().slice(0, 200);
  if (title.length === 0) return err('invalid_request', 'title cannot be empty', 400);

  try {
    await db.update(clips).set({ title }).where(eq(clips.id, id));
  } catch (e) {
    console.error('[clips PATCH] db update failed id=%s err=%s', id, errorMessage(e));
    return err('db_error', 'failed to rename clip', 500);
  }

  return ok({ id, title });
}

/** DELETE /api/clips/[id] — owner-only. Removes the R2 mp4 + thumb and the row. */
export async function DELETE(_req: Request, { params }: { params: Promise<Params> }): Promise<Response> {
  const { id } = await params;
  if (!isValidClipId(id)) return err('not_found', 'clip not found', 404);

  let row: { ownerToken: string | null; r2Key: string; thumbR2Key: string | null } | undefined;
  try {
    const rows = await db
      .select({ ownerToken: clips.ownerToken, r2Key: clips.r2Key, thumbR2Key: clips.thumbR2Key })
      .from(clips)
      .where(eq(clips.id, id))
      .limit(1);
    row = rows[0];
  } catch (e) {
    console.error('[clips DELETE] db select failed id=%s err=%s', id, errorMessage(e));
    return err('db_error', 'failed to load clip', 500);
  }

  if (!row) return err('not_found', 'clip not found', 404);
  if (!(await isOwner(row.ownerToken))) return err('forbidden', 'not your clip', 403);

  // Best-effort, idempotent R2 cleanup. Any straggler is swept by the bucket's
  // 7-day lifecycle rule, so a failure here doesn't block removing the row.
  const cleanup = await Promise.allSettled([
    deleteObject(row.r2Key),
    ...(row.thumbR2Key ? [deleteObject(row.thumbR2Key)] : []),
  ]);
  for (const r of cleanup) {
    if (r.status === 'rejected') {
      console.error('[clips DELETE] r2 cleanup failed id=%s err=%s', id, errorMessage(r.reason));
    }
  }

  try {
    await db.delete(clips).where(eq(clips.id, id));
  } catch (e) {
    console.error('[clips DELETE] db delete failed id=%s err=%s', id, errorMessage(e));
    return err('db_error', 'failed to delete clip', 500);
  }

  return ok({ id, deleted: true });
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
