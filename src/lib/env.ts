import { z } from 'zod';

/**
 * Typed env-var loader. Validates `process.env` against the schema at module
 * load time and throws on any missing or malformed variable. Import this from
 * `lib/env` and use `env.FOO` everywhere instead of `process.env.FOO`.
 *
 * Next.js auto-loads .env.local / .env at runtime, and drizzle.config.ts
 * explicitly calls `loadEnvConfig` so drizzle-kit sees the same values.
 */
const envSchema = z.object({
  DATABASE_URL: z.string().url(),

  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET_NAME: z.string().min(1),

  // Speed-bump auth for /api/clips/*. Long enough to survive a casual leak,
  // not a substitute for real per-user auth (that's Phase 2C).
  WIPSHARE_UPLOAD_SECRET: z.string().min(16, 'WIPSHARE_UPLOAD_SECRET must be at least 16 chars'),

  // No trailing slash. Used to build viewer URLs and OG metadata.
  NEXT_PUBLIC_BASE_URL: z.string().url(),

  // Optional: future custom domain in front of R2 for public reads.
  R2_PUBLIC_HOSTNAME: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  ${i.path.join('.')}: ${i.message}`)
    .join('\n');
  throw new Error(`Invalid environment variables:\n${issues}`);
}

export const env = parsed.data;
