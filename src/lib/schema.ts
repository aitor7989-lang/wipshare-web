import { bigint, check, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * Allowed values for `clips.status`. Mirrored as a TypeScript union AND a SQL
 * CHECK constraint so an out-of-band write into the database can't poison the
 * type system.
 */
export const clipStatuses = ['pending', 'ready', 'failed'] as const;
export type ClipStatus = (typeof clipStatuses)[number];

/**
 * Per-clip access visibility. 'public' = anyone with the link (optionally gated
 * by a password); 'private' = owner only. Mirrored as a TS union AND a SQL CHECK
 * constraint so an out-of-band write can't introduce an unknown value.
 */
export const clipVisibilities = ['public', 'private'] as const;
export type ClipVisibility = (typeof clipVisibilities)[number];

export const clips = pgTable(
  'clips',
  {
    id: text('id').primaryKey(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    status: text('status').notNull().default('pending').$type<ClipStatus>(),
    mime: text('mime').notNull().default('video/mp4'),
    // Display name (the uploaded filename without extension), owner-renameable.
    // Nullable so pre-title rows and filename-less uploads stay valid; the UI
    // falls back to a date-derived label when null.
    title: text('title'),
    // mode:'number' is fine here: our max-allowed size is ~500 MB, well below
    // Number.MAX_SAFE_INTEGER (9 PB). If we ever store larger clips, switch to
    // mode:'bigint' and propagate bigint through the stack.
    sizeBytes: bigint('size_bytes', { mode: 'number' }),
    r2Key: text('r2_key').notNull(),
    // Reserved for Phase 2C (server-side ffprobe). Phase 2A doesn't populate.
    durationSeconds: integer('duration_seconds'),
    // Phase 2B: pixel dimensions of the clip (client-reported) + poster thumbnail.
    width: integer('width'),
    height: integer('height'),
    thumbR2Key: text('thumb_r2_key'),
    // Phase 2C groundwork: ownerToken ties a clip to the uploading device (for a
    // future library + owner-only edits); expiresAt drives auto-expiry. Both
    // nullable so existing rows and non-owner-aware clients stay valid.
    ownerToken: text('owner_token'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    // Phase 7: per-clip privacy. `visibility` gates access ('public' = link, maybe
    // password; 'private' = owner only). `password_hash` is `salt:hash` (hex,
    // scrypt) and only meaningful while public; null = no password. The hash is
    // never returned to a client or rendered into a page.
    visibility: text('visibility').notNull().default('public').$type<ClipVisibility>(),
    passwordHash: text('password_hash'),
  },
  (t) => [
    check('clips_status_check', sql`${t.status} IN ('pending', 'ready', 'failed')`),
    check('clips_visibility_check', sql`${t.visibility} IN ('public', 'private')`),
  ],
);

export type Clip = typeof clips.$inferSelect;
export type NewClip = typeof clips.$inferInsert;
