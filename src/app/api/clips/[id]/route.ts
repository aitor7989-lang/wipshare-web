import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { clips, type ClipVisibility } from '@/lib/schema';
import { ok, err } from '@/lib/api-response';
import { getOwnerToken } from '@/lib/identity';
import { isValidClipId } from '@/lib/ids';
import { deleteObject } from '@/lib/r2';
import { hashPassword } from '@/lib/password';

export const runtime = 'nodejs';

type Params = { id: string };

// Every field optional; at least one must be present. `title` renames;
// `visibility` flips public/private; `password` sets (non-empty) or clears
// ('' | null) the view password. Private supersedes - a private clip never
// carries a password (the UI disables the password control when private).
const patchSchema = z
  .object({
    title: z.string().trim().min(1, 'title is required').max(200, 'title is too long').optional(),
    visibility: z.enum(['public', 'private']).optional(),
    password: z.string().max(200, 'password is too long').nullable().optional(),
  })
  .refine((v) => v.title !== undefined || v.visibility !== undefined || v.password !== undefined, {
    message: 'nothing to update',
  });

/**
 * True when the verified wip_uid cookie owns this clip. Ownership is decided
 * server-side from the signed cookie - never trusted from the request body/query.
 */
async function isOwner(clipOwnerToken: string | null): Promise<boolean> {
  if (clipOwnerToken === null) return false;
  const owner = await getOwnerToken();
  return owner !== null && owner === clipOwnerToken;
}

/** PATCH /api/clips/[id] - owner-only rename and/or visibility + password. */
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

  let row:
    | { ownerToken: string | null; title: string | null; visibility: ClipVisibility; passwordHash: string | null }
    | undefined;
  try {
    const rows = await db
      .select({
        ownerToken: clips.ownerToken,
        title: clips.title,
        visibility: clips.visibility,
        passwordHash: clips.passwordHash,
      })
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

  const updates: Partial<{ title: string; visibility: ClipVisibility; passwordHash: string | null }> = {};

  if (parsed.data.title !== undefined) {
    // Store the title without the clip's extension; the download re-appends ".mp4".
    const title = parsed.data.title.replace(/\.mp4$/i, '').trim().slice(0, 200);
    if (title.length === 0) return err('invalid_request', 'title cannot be empty', 400);
    updates.title = title;
  }

  if (parsed.data.visibility !== undefined) updates.visibility = parsed.data.visibility;

  // The visibility this clip will have once the patch lands.
  const nextVisibility: ClipVisibility = parsed.data.visibility ?? row.visibility;

  if (nextVisibility === 'private') {
    // Private supersedes: never keep a password on a private clip. Only write
    // when flipping to private or there's actually a password to drop.
    if (parsed.data.visibility === 'private' || row.passwordHash !== null) updates.passwordHash = null;
  } else if (parsed.data.password !== undefined) {
    // Public + password field present → set (non-empty) or clear ('' | null).
    const pw = parsed.data.password ?? '';
    updates.passwordHash = pw.length > 0 ? hashPassword(pw) : null;
  }

  if (Object.keys(updates).length > 0) {
    try {
      await db.update(clips).set(updates).where(eq(clips.id, id));
    } catch (e) {
      console.error('[clips PATCH] db update failed id=%s err=%s', id, errorMessage(e));
      return err('db_error', 'failed to update clip', 500);
    }
  }

  // Echo the resolved state so the client can reconcile its optimistic update.
  // Never return password_hash - only whether one is set.
  const finalHasPassword =
    nextVisibility === 'public'
      ? updates.passwordHash !== undefined
        ? updates.passwordHash !== null
        : row.passwordHash !== null
      : false;

  return ok({
    id,
    title: updates.title ?? row.title,
    visibility: nextVisibility,
    hasPassword: finalHasPassword,
  });
}

/** DELETE /api/clips/[id] - owner-only. Removes the R2 mp4 + thumb and the row. */
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
