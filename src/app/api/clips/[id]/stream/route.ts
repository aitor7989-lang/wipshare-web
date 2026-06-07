import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { clips } from '@/lib/schema';
import { presignGet } from '@/lib/r2';
import { isValidClipId } from '@/lib/ids';
import { canReadClipBytes } from '@/lib/clip-access';

export const runtime = 'nodejs';

type Params = { id: string };

/**
 * GET /api/clips/[id]/stream
 *
 * Powers the <video> element on the viewer page. Runs a server-side access check
 * (owner / public / public+password+grant / private) BEFORE issuing a SHORT-lived
 * (~120s) presigned R2 GET URL, then 302-redirects to it. The redirect isn't
 * cached, so a leaked URL dies in ~2 minutes and revoked access is enforced on
 * the next load.
 *
 *   404 unknown/not-ready   410 expired   403 not allowed
 *
 * Non-JSON responses don't use the ok/err envelope — the redirect Location
 * header IS the response payload, and the status code carries the rest.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<Params> },
): Promise<Response> {
  const { id } = await params;
  if (!isValidClipId(id)) {
    return new Response('Not Found', { status: 404 });
  }

  let row:
    | {
        r2Key: string;
        status: string;
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
    console.error('[stream] db select failed id=%s err=%s', id, errorMessage(e));
    return new Response('Internal Server Error', { status: 500 });
  }

  if (!row || row.status !== 'ready') {
    return new Response('Not Found', { status: 404 });
  }
  // Lazy expiry: a clip past its expires_at is gone, even before the R2
  // lifecycle rule sweeps the object.
  if (row.expiresAt !== null && row.expiresAt.getTime() <= Date.now()) {
    return new Response('Gone', { status: 410 });
  }

  // Access gate (server-side, never trusted from the client): owner always;
  // public + no password always; public + password only with a valid view
  // grant; private to a non-owner is forbidden. Runs BEFORE any presign.
  if (!(await canReadClipBytes(row, id))) {
    return new Response('Forbidden', { status: 403 });
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
      // Don't cache the redirect: every load re-runs the access check and mints
      // a fresh short-lived presign, so revoked access takes effect immediately
      // and a cached redirect never points at an already-expired URL.
      'Cache-Control': 'private, no-store',
    },
  });
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
