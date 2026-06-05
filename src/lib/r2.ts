import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from './env';

/**
 * Cloudflare R2 is S3-API-compatible. We point the AWS SDK v3 client at R2's
 * account-scoped endpoint with `region: 'auto'`. R2 still requires SigV4 — the
 * SDK default — but ignores the `region` value beyond presence.
 */
export const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
});

const PUT_TTL_SECONDS = 60 * 15;          // 15 minutes for client to upload
const GET_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days for viewer playback

export async function presignPut(
  key: string,
  contentType: string,
  contentLength: number,
): Promise<string> {
  const cmd = new PutObjectCommand({
    Bucket: env.R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
    ContentLength: contentLength,
  });
  return getSignedUrl(r2, cmd, { expiresIn: PUT_TTL_SECONDS });
}

export async function presignGet(key: string): Promise<string> {
  const cmd = new GetObjectCommand({
    Bucket: env.R2_BUCKET_NAME,
    Key: key,
  });
  return getSignedUrl(r2, cmd, { expiresIn: GET_TTL_SECONDS });
}

/**
 * Deletes an R2 object. S3/R2 deletes are idempotent — removing a key that's
 * already gone returns success — so callers can re-run delete safely.
 */
export async function deleteObject(key: string): Promise<void> {
  await r2.send(new DeleteObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: key }));
}

export type HeadResult = { contentLength: number };

/**
 * HEADs the R2 object to confirm the upload landed. Returns null on any
 * failure (object missing, network error, etc.) — callers treat null as
 * "not present" without needing to inspect the underlying SDK error.
 */
export async function headObject(key: string): Promise<HeadResult | null> {
  try {
    const result = await r2.send(new HeadObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: key,
    }));
    return { contentLength: result.ContentLength ?? 0 };
  } catch {
    return null;
  }
}

export type ObjectBytes = { body: Uint8Array<ArrayBuffer>; contentType: string | undefined };

/**
 * Fetches a (small) object's bytes from R2 to proxy back through our API.
 * Used for thumbnails — tiny files where proxying keeps the URL stable and
 * crawler-friendly (vs. a presigned redirect that expires). Returns null if
 * the object is missing or unreadable.
 */
export async function getObjectBytes(key: string): Promise<ObjectBytes | null> {
  try {
    const result = await r2.send(new GetObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: key,
    }));
    if (!result.Body) return null;
    // The SDK returns Uint8Array<ArrayBufferLike>; re-wrap over a guaranteed
    // ArrayBuffer so it satisfies BodyInit's ArrayBufferView<ArrayBuffer>
    // (TS 5.7 made typed arrays generic over their backing buffer). The copy
    // is negligible — thumbnails are tens of KB.
    const raw = await result.Body.transformToByteArray();
    const body = new Uint8Array(raw.length);
    body.set(raw);
    return { body, contentType: result.ContentType };
  } catch {
    return null;
  }
}
