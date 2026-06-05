import { ok, err } from '@/lib/api-response';
import { getOwnerToken } from '@/lib/identity';
import { listOwnerClips } from '@/lib/clip-queries';

export const runtime = 'nodejs';

const NO_STORE = { headers: { 'Cache-Control': 'private, no-store' } } as const;

/**
 * GET /api/me/clips
 *
 * The signed-in device's library: this owner's ready, non-expired clips, newest
 * first. Scope comes ONLY from the signed wip_uid cookie (via getOwnerToken),
 * never from a query param. No cookie → an empty list.
 */
export async function GET(): Promise<Response> {
  const owner = await getOwnerToken();
  if (owner === null) return ok({ clips: [] }, NO_STORE);

  try {
    const rows = await listOwnerClips(owner);
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
    return ok({ clips: data }, NO_STORE);
  } catch (e) {
    console.error('[me/clips] db select failed err=%s', e instanceof Error ? e.message : String(e));
    return err('db_error', 'failed to load clips', 500);
  }
}
