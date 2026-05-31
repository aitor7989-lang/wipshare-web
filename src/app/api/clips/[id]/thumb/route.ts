import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { clips } from '@/lib/schema';
import { getObjectBytes } from '@/lib/r2';
import { isValidClipId } from '@/lib/ids';

export const runtime = 'nodejs';

type Params = { id: string };

/**
 * GET /api/clips/[id]/thumb
 *
 * Public — no auth. Unlike /stream (a 302 to a presigned, expiring R2 URL),
 * this PROXIES the thumbnail bytes back directly. Thumbnails are tiny, and a
 * stable non-expiring URL is what link-preview crawlers (Slack, Discord) need
 * for og:image. 404 if the clip isn't ready or has no thumbnail.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<Params> },
): Promise<Response> {
  const { id } = await params;
  if (!isValidClipId(id)) {
    return new Response('Not Found', { status: 404 });
  }

  let row: { thumbR2Key: string | null; status: string } | undefined;
  try {
    const rows = await db
      .select({ thumbR2Key: clips.thumbR2Key, status: clips.status })
      .from(clips)
      .where(eq(clips.id, id))
      .limit(1);
    row = rows[0];
  } catch (e) {
    console.error('[thumb] db select failed id=%s err=%s', id, e instanceof Error ? e.message : String(e));
    return new Response('Internal Server Error', { status: 500 });
  }

  if (!row || row.status !== 'ready' || row.thumbR2Key === null) {
    return new Response('Not Found', { status: 404 });
  }

  const obj = await getObjectBytes(row.thumbR2Key);
  if (obj === null) {
    return new Response('Not Found', { status: 404 });
  }

  return new Response(obj.body, {
    status: 200,
    headers: {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
