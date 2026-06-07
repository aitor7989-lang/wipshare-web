import { and, desc, eq, gt } from 'drizzle-orm';
import { db } from './db';
import { clips, type ClipVisibility } from './schema';

export type LibraryClip = {
  id: string;
  title: string | null;
  createdAt: Date;
  expiresAt: Date | null;
  width: number | null;
  height: number | null;
  thumbR2Key: string | null;
  visibility: ClipVisibility;
  hasPassword: boolean;
};

/**
 * An owner's ready, non-expired clips, newest first. Shared by GET /api/me/clips
 * and the server-rendered /me page so both apply identical scoping. The clip's
 * password_hash is read only to derive `hasPassword` — the hash itself never
 * leaves this function, so it can't leak into a payload or a page.
 */
export async function listOwnerClips(ownerToken: string): Promise<LibraryClip[]> {
  const rows = await db
    .select({
      id: clips.id,
      title: clips.title,
      createdAt: clips.createdAt,
      expiresAt: clips.expiresAt,
      width: clips.width,
      height: clips.height,
      thumbR2Key: clips.thumbR2Key,
      visibility: clips.visibility,
      passwordHash: clips.passwordHash,
    })
    .from(clips)
    .where(
      and(
        eq(clips.ownerToken, ownerToken),
        eq(clips.status, 'ready'),
        gt(clips.expiresAt, new Date()), // excludes expired (and null-expiry) rows
      ),
    )
    .orderBy(desc(clips.createdAt))
    .limit(200);

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    createdAt: r.createdAt,
    expiresAt: r.expiresAt,
    width: r.width,
    height: r.height,
    thumbR2Key: r.thumbR2Key,
    visibility: r.visibility,
    hasPassword: r.passwordHash !== null,
  }));
}
