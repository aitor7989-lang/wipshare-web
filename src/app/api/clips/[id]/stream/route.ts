import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { clips } from '@/lib/schema';
import { presignGet } from '@/lib/r2';
import { isValidClipId } from '@/lib/ids';

export const runtime = 'nodejs';

type Params = { id: string };

/**
 * GET /api/clips/[id]/stream
 *
 * Public — no auth. Powers the <video> element on the viewer page. Returns a
 * 302 redirect to a 7-day presigned R2 GET URL. Browser caches the redirect
 * (not the video) for 5 minutes; the underlying signed URL is good for 7 days
 * so the cached redirect always points at a still-valid object.
 *
 * Non-JSON responses don't use the ok/err envelope — the redirect Location
 * header IS the response payload, and 404 here is just a plain status.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<Params> },
): Promise<Response> {
  const { id } = await params;
  if (!isValidClipId(id)) {
    return new Response('Not Found', { status: 404 });
  }

  let row: { r2Key: string; status: string } | undefined;
  try {
    const rows = await db
      .select({ r2Key: clips.r2Key, status: clips.status })
      .from(clips)
      .where(eq(clips.id, id))
      .limit(1);
    row = rows[0];
  } catch (e) {
    console.error('[stream] db select failed id=%s err=%s', id, errorMessage(e));
    return new Response('Internal Server Error', { status: 500 });
  }

  if (!row || row.status !== 'ready') {
    return new Response('Not Found', { status: 404 });
  }

  let url: string;
  try {
    url = await presignGet(row.r2Key);
  } catch (e) {
    console.error('[stream] presign failed id=%s err=%s', id, errorMessage(e));
    return new Response('Internal Server Error', { status: 500 });
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: url,
      // Brief browser-side cache so a hot viewer doesn't burn a presign per
      // play. Private so CDN edges don't store it across users.
      'Cache-Control': 'private, max-age=300',
    },
  });
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
