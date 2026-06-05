import { and, desc, eq, gt } from 'drizzle-orm';
import { db } from '@/lib/db';
import { clips } from '@/lib/schema';
import { ok, err } from '@/lib/api-response';
import { getOwnerToken } from '@/lib/identity';

export const runtime = 'nodejs';

/**
 * GET /api/me/clips
 *
 * The signed-in device's library: this owner's clips that are ready and not yet
 * expired, newest first. Scope comes ONLY from the signed wip_uid cookie (via
 * getOwnerToken) — never from a query param — so it can't be spoofed. No cookie
 * → an empty list (a fresh, cookieless browser sees the empty state).
 */
export async function GET(): Promise<Response> {
  const owner = await getOwnerToken();
  if (owner === null) return ok({ clips: [] }, { headers: { 'Cache-Control': 'private, no-store' } });

  let rows;
  try {
    rows = await db
      .select({
        id: clips.id,
        title: clips.title,
        createdAt: clips.createdAt,
        expiresAt: clips.expiresAt,
        width: clips.width,
        height: clips.height,
        thumbR2Key: clips.thumbR2Key,
      })
      .from(clips)
      .where(
        and(
          eq(clips.ownerToken, owner),
          eq(clips.status, 'ready'),
          gt(clips.expiresAt, new Date()), // excludes expired (and null-expiry) rows
        ),
      )
      .orderBy(desc(clips.createdAt))
      .limit(200);
  } catch (e) {
    console.error('[me/clips] db select failed err=%s', errorMessage(e));
    return err('db_error', 'failed to load clips', 500);
  }

  const data = rows.map((r) => ({
    id: r.id,
    title: r.title,
    createdAt: r.createdAt.toISOString(),
    expiresAt: r.expiresAt?.toISOString() ?? null,
    width: r.width,
    height: r.height,
    thumbUrl: r.thumbR2Key ? `/api/clips/${r.id}/thumb` : null,
    viewerUrl: `/c/${r.id}`,
  }));

  return ok({ clips: data }, { headers: { 'Cache-Control': 'private, no-store' } });
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
