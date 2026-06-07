import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { clips } from '@/lib/schema';
import { presignGetDownload } from '@/lib/r2';
import { isValidClipId } from '@/lib/ids';
import { clipDisplayTitle, safeFilenameBase } from '@/lib/clip-format';
import { canReadClipBytes } from '@/lib/clip-access';

export const runtime = 'nodejs';

type Params = { id: string };

/**
 * GET /api/clips/[id]/download
 *
 * Like /stream (same access gate + short-lived presign), but forces a save
 * named "{title}.mp4": the clip's stored title with the extension re-appended
 * server-side, baked into the presigned R2 URL's Content-Disposition.
 * 404 unknown/not-ready, 410 expired, 403 not allowed.
 */
export async function GET(_req: Request, { params }: { params: Promise<Params> }): Promise<Response> {
  const { id } = await params;
  if (!isValidClipId(id)) return new Response('Not Found', { status: 404 });

  let row:
    | {
        r2Key: string;
        status: string;
        title: string | null;
        createdAt: Date;
        expiresAt: Date | null;
        ownerToken: string | null;
        visibility: string;
        passwordHash: string | null;
      }
    | undefined;
  try {
    const rows = await db
      .select({
        r2Key: clips.r2Key,
        status: clips.status,
        title: clips.title,
        createdAt: clips.createdAt,
        expiresAt: clips.expiresAt,
        ownerToken: clips.ownerToken,
        visibility: clips.visibility,
        passwordHash: clips.passwordHash,
      })
      .from(clips)
      .where(eq(clips.id, id))
      .limit(1);
    row = rows[0];
  } catch (e) {
    console.error('[download] db select failed id=%s err=%s', id, e instanceof Error ? e.message : String(e));
    return new Response('Internal Server Error', { status: 500 });
  }

  if (!row || row.status !== 'ready') return new Response('Not Found', { status: 404 });
  if (row.expiresAt !== null && row.expiresAt.getTime() <= Date.now()) {
    return new Response('Gone', { status: 410 });
  }

  // Same gate as /stream - a private clip (or a passworded one without a valid
  // view grant) can't be downloaded by a non-owner, even via a direct URL.
  if (!(await canReadClipBytes(row, id))) {
    return new Response('Forbidden', { status: 403 });
  }

  const filename = `${safeFilenameBase(clipDisplayTitle(row.title, row.createdAt))}.mp4`;

  let url: string;
  try {
    url = await presignGetDownload(row.r2Key, filename);
  } catch (e) {
    console.error('[download] presign failed id=%s err=%s', id, e instanceof Error ? e.message : String(e));
    return new Response('Internal Server Error', { status: 500 });
  }

  return new Response(null, {
    status: 302,
    headers: { Location: url, 'Cache-Control': 'private, no-store' },
  });
}
