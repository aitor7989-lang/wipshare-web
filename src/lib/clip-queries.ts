import { and, desc, eq, gt } from 'drizzle-orm';
import { db } from './db';
import { clips } from './schema';

export type LibraryClip = {
  id: string;
  title: string | null;
  createdAt: Date;
  expiresAt: Date | null;
  width: number | null;
  height: number | null;
  thumbR2Key: string | null;
};

/**
 * An owner's ready, non-expired clips, newest first. Shared by GET /api/me/clips
 * and the server-rendered /me page so both apply identical scoping.
 */
export async function listOwnerClips(ownerToken: string): Promise<LibraryClip[]> {
  return db
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
        eq(clips.ownerToken, ownerToken),
        eq(clips.status, 'ready'),
        gt(clips.expiresAt, new Date()), // excludes expired (and null-expiry) rows
      ),
    )
    .orderBy(desc(clips.createdAt))
    .limit(200);
}
