import { z } from 'zod';
import { db } from '@/lib/db';
import { clips } from '@/lib/schema';
import { ok, err } from '@/lib/api-response';
import { requireBearerToken } from '@/lib/auth';
import { rateLimit } from '@/lib/ratelimit';
import { newClipId } from '@/lib/ids';
import { presignPut } from '@/lib/r2';
import { env } from '@/lib/env';

export const runtime = 'nodejs';

const MAX_SIZE_BYTES = 524_288_000;  // 500 MiB — hard ceiling on the presigned PUT
const MIN_SIZE_BYTES = 1024;         // 1 KiB — guards against pathological "0-byte" tests
const MAX_THUMB_BYTES = 5_000_000;   // 5 MB — generous for a JPEG poster frame

const initiateSchema = z.object({
  size_bytes: z
    .number()
    .int()
    .min(MIN_SIZE_BYTES, `size_bytes must be >= ${MIN_SIZE_BYTES}`)
    .max(MAX_SIZE_BYTES, `size_bytes must be <= ${MAX_SIZE_BYTES}`),
  mime: z.literal('video/mp4'),
  // Phase 2B optional fields — clip pixel dimensions + poster thumbnail.
  width: z.number().int().min(1).max(10_000).optional(),
  height: z.number().int().min(1).max(10_000).optional(),
  thumb_size_bytes: z.number().int().min(1).max(MAX_THUMB_BYTES).optional(),
  // Phase 2C groundwork: opaque per-device owner token (a client GUID). Bounded
  // to keep the column small; never used for auth, only association.
  owner_token: z.string().min(1).max(100).optional(),
  // Optional display name (the mp4 filename). Stored as the clip title without
  // extension; the owner can rename it later.
  filename: z.string().min(1).max(260).optional(),
});

/** The clip's default title: the uploaded filename, sans any path and extension. */
function clipTitleFromFilename(filename: string | undefined): string | null {
  if (filename === undefined) return null;
  const base = filename.split(/[\\/]/).pop() ?? filename; // strip any directory
  const noExt = base.replace(/\.[^.]+$/, ''); // strip the last extension
  const trimmed = noExt.trim().slice(0, 200);
  return trimmed.length > 0 ? trimmed : null;
}

// Every clip auto-expires one week after upload.
const CLIP_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function POST(req: Request): Promise<Response> {
  const authError = requireBearerToken(req);
  if (authError !== null) return authError;

  const limit = rateLimit(req, 30, 60_000);
  if (!limit.ok) {
    return err(
      'rate_limited',
      `try again in ${limit.retryAfterSeconds ?? 60}s`,
      429,
      { headers: { 'Retry-After': String(limit.retryAfterSeconds ?? 60) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return err('invalid_request', 'body is not valid JSON', 400);
  }

  const parsed = initiateSchema.safeParse(body);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('; ');
    return err('invalid_request', issues, 400);
  }

  const id = newClipId();
  const r2Key = `clips/${id}.mp4`;
  const wantsThumb = parsed.data.thumb_size_bytes !== undefined;
  const thumbR2Key = wantsThumb ? `clips/${id}.jpg` : null;

  try {
    await db.insert(clips).values({
      id,
      r2Key,
      mime: parsed.data.mime,
      sizeBytes: parsed.data.size_bytes,
      status: 'pending',
      title: clipTitleFromFilename(parsed.data.filename),
      width: parsed.data.width ?? null,
      height: parsed.data.height ?? null,
      thumbR2Key,
      ownerToken: parsed.data.owner_token ?? null,
      expiresAt: new Date(Date.now() + CLIP_TTL_MS),
    });
  } catch (e) {
    console.error('[initiate] db insert failed id=%s err=%s', id, errorMessage(e));
    return err('db_error', 'failed to create clip record', 500);
  }

  let uploadUrl: string;
  try {
    uploadUrl = await presignPut(r2Key, parsed.data.mime, parsed.data.size_bytes);
  } catch (e) {
    console.error('[initiate] presign put failed id=%s err=%s', id, errorMessage(e));
    return err('storage_error', 'failed to issue upload URL', 500);
  }

  let thumbnailUploadUrl: string | null = null;
  if (wantsThumb && thumbR2Key !== null && parsed.data.thumb_size_bytes !== undefined) {
    try {
      thumbnailUploadUrl = await presignPut(thumbR2Key, 'image/jpeg', parsed.data.thumb_size_bytes);
    } catch (e) {
      // Non-fatal: the clip can still go ready without a thumbnail. Log and
      // return null so the client simply skips the thumbnail PUT.
      console.error('[initiate] presign thumb put failed id=%s err=%s', id, errorMessage(e));
      thumbnailUploadUrl = null;
    }
  }

  console.log('[initiate] created id=%s size=%d thumb=%s', id, parsed.data.size_bytes, wantsThumb);

  return ok({
    id,
    uploadUrl,
    thumbnailUploadUrl,
    completeUrl: `/api/clips/${id}/complete`,
    viewerUrl: `${env.NEXT_PUBLIC_BASE_URL}/c/${id}`,
  });
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
