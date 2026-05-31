# WipShare Web — Phase 2A

Cloud upload backend for the WipShare Windows client. Receives MP4 uploads
into Cloudflare R2 and serves them via shareable viewer pages.

This is the **backend in isolation** — Phase 2A. The Windows client (Phase 1
+ 1.5, in the sibling `WipShare.Client/` repo) is **not** modified here.
Phase 2B will wire the client to this backend via a background upload queue.

## Stack

- **Next.js 16** App Router · TypeScript strict + `noUncheckedIndexedAccess` · Node 20+ runtime
- **Tailwind 4** with CSS-based `@theme` tokens
- **Cloudflare R2** via `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` (15 min PUT, 7 day GET)
- **Neon Postgres** via `@neondatabase/serverless` + Drizzle ORM
- **Zod** for input validation · **nanoid** for clip IDs (12-char, 57-char alphabet)
- pnpm as package manager
- Deploys to **Vercel**

> **Version note:** The original Phase 2A spec called for Next 15 + Tailwind
> 3. `create-next-app@latest` now installs Next 16 + Tailwind 4 by default;
> we kept the latest (you explicitly approved). The only user-visible
> consequence: theme tokens live in `globals.css` (`@theme` block) rather
> than `tailwind.config.ts`.

## Architecture in one paragraph

A POST to `/api/clips/initiate` (bearer-auth, rate-limited) creates a row in
`clips` with `status='pending'` and returns a 15-minute presigned R2 PUT URL.
The client uploads the MP4 directly to R2 (no bytes transit our server). A
POST to `/api/clips/[id]/complete` HEADs the R2 object and flips the row to
`status='ready'`, or to `'failed'` if the object isn't there. The public
viewer at `/c/[id]` server-renders a dark page with a `<video>` element whose
`src` is `/api/clips/[id]/stream`, which 302-redirects to a 7-day presigned R2
GET URL (cached privately for 5 minutes by the browser).

```
client                       Next.js                     Postgres     R2
  │  POST initiate ─────────►  │ insert(status=pending)──►  │
  │  ◄─── { uploadUrl, … } ──  │ presign PUT ─────────────────────► │
  │  PUT $uploadUrl ────────────────────────────────────────────────►│
  │  POST complete ─────────►  │ HEAD R2 ──────────────────────────►│
  │                            │ update(status=ready) ───►  │
  │  GET /c/{id} ─────────────►│ select ──────────────────►  │
  │  GET /api/.../stream ────►│ presign GET, 302 ────────────────►│
```

## One-time external setup

### 1. Neon (Postgres)

1. Sign up at [neon.tech](https://neon.tech).
2. Create a new project. Name it `wipshare` or whatever you like.
3. In the dashboard, find **Connection string** → copy the **Pooled connection** (it includes `?sslmode=require`).
4. Paste it into `.env.local` as `DATABASE_URL`.

### 2. Cloudflare R2

1. Sign in to [dash.cloudflare.com](https://dash.cloudflare.com).
2. Navigate to **R2 Object Storage** → **Create bucket**. Name: `wipshare-clips`. Location: keep default.
3. Open the bucket → **Settings** → **CORS policy** → paste:

   ```json
   [
     {
       "AllowedOrigins": ["*"],
       "AllowedMethods": ["PUT", "GET", "HEAD"],
       "AllowedHeaders": ["*"],
       "ExposeHeaders": ["ETag"]
     }
   ]
   ```

4. Back at the R2 overview → **Manage R2 API Tokens** → **Create API token**.
   - Token name: `wipshare-web`
   - Permissions: **Object Read & Write**
   - Specify bucket: `wipshare-clips` (scope it, don't leave as "all")
   - TTL: as long as you want
5. Copy the **Access Key ID**, **Secret Access Key**, and the **Account ID**
   shown at the top of the R2 dashboard. Paste all three into `.env.local`.

### 3. Vercel (only when you're ready to deploy)

1. Push this repo to GitHub.
2. In Vercel, **Add New → Project → Import** your repo.
3. Framework preset auto-detects Next.js.
4. **Environment Variables** → add every var from `.env.example`. For
   `NEXT_PUBLIC_BASE_URL`, use your final `https://your-app.vercel.app` URL
   (or your custom domain).
5. Deploy. The build runs `pnpm install && pnpm build` automatically.

## Local development

```bash
# Install (the first time)
pnpm install

# Copy the template and fill in your secrets
cp .env.example .env.local
# then edit .env.local

# Generate a strong upload secret if you don't have one
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"

# Apply the initial migration to your Neon database
pnpm db:migrate

# Start the dev server
pnpm dev
```

Open `http://localhost:3000` — you should see the landing page.

## Curl flow (copy-pasteable)

```bash
# 0. Set your bearer token (must match WIPSHARE_UPLOAD_SECRET in .env.local)
export TOKEN="<paste your WIPSHARE_UPLOAD_SECRET here>"
export BASE="http://localhost:3000"
# Stand-in for the desktop client's per-device owner_token (a GUID).
export OWNER="$(node -e "console.log(crypto.randomUUID())")"

# 0b. Verify an invite code — what the client's first-run window calls. The
#     "code" is the same shared secret as $TOKEN. 200 on match, 401 otherwise.
curl -s -X POST "$BASE/api/access/verify" \
  -H "Content-Type: application/json" \
  -d "{\"code\": \"$TOKEN\"}"
# → {"data":{"ok":true}}   (a wrong code returns {"error":{"code":"invalid_code"}})

# Make a tiny test mp4 + jpg — or use real ones you have on disk.
# (Stub files ≥1 KiB satisfy the validators and exercise the flow end-to-end.
# Browsers won't play/show them, but the API accepts them.)
head -c 4096 /dev/urandom > sample.mp4
head -c 2048 /dev/urandom > sample.jpg

# 1. Initiate — get upload URLs (now including width/height + a thumbnail)
INIT=$(curl -s -X POST "$BASE/api/clips/initiate" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"size_bytes\": $(stat -c%s sample.mp4 2>/dev/null || stat -f%z sample.mp4), \"mime\": \"video/mp4\", \"width\": 1280, \"height\": 720, \"thumb_size_bytes\": $(stat -c%s sample.jpg 2>/dev/null || stat -f%z sample.jpg), \"owner_token\": \"$OWNER\"}")
echo "$INIT"

ID=$(echo "$INIT" | python -c "import json,sys; print(json.load(sys.stdin)['data']['id'])")
UPLOAD_URL=$(echo "$INIT" | python -c "import json,sys; print(json.load(sys.stdin)['data']['uploadUrl'])")
THUMB_URL=$(echo "$INIT" | python -c "import json,sys; print(json.load(sys.stdin)['data']['thumbnailUploadUrl'] or '')")
VIEWER_URL=$(echo "$INIT" | python -c "import json,sys; print(json.load(sys.stdin)['data']['viewerUrl'])")

# 2. PUT the mp4 directly to R2
curl -X PUT "$UPLOAD_URL" \
  -H "Content-Type: video/mp4" \
  --data-binary @sample.mp4 \
  -w "mp4 HTTP %{http_code}\n"

# 3. PUT the jpg thumbnail to R2 (only if a thumbnailUploadUrl came back)
if [ -n "$THUMB_URL" ]; then
  curl -X PUT "$THUMB_URL" \
    -H "Content-Type: image/jpeg" \
    --data-binary @sample.jpg \
    -w "jpg HTTP %{http_code}\n"
fi

# 4. Mark complete
curl -s -X POST "$BASE/api/clips/$ID/complete" \
  -H "Authorization: Bearer $TOKEN"

# 5. Thumbnail is proxied (not redirected) — should return image/jpeg
curl -s -o /dev/null -w "thumb HTTP %{http_code}, type=%{content_type}\n" \
  "$BASE/api/clips/$ID/thumb"

# 6. Open the viewer in your browser
echo "Open: $VIEWER_URL"
```

If you have `jq` instead of python:

```bash
ID=$(echo "$INIT" | jq -r .data.id)
UPLOAD_URL=$(echo "$INIT" | jq -r .data.uploadUrl)
THUMB_URL=$(echo "$INIT" | jq -r '.data.thumbnailUploadUrl // ""')
```

### What you should see

- **Step 1** returns `{ "data": { "id", "uploadUrl", "thumbnailUploadUrl", "completeUrl", "viewerUrl" } }`
- **Step 2/3** return HTTP 200 (R2's responses to the PUTs)
- **Step 4** returns `{ "data": { "id", "status": "ready", "viewerUrl" } }`
- **Step 5** returns HTTP 200 with `type=image/jpeg`
- **Step 6** in a browser shows the viewer; the clip's `/c/{id}` page now carries an `og:image` pointing at `/api/clips/{id}/thumb`

## API reference

All API routes run on **Node runtime** (not Edge) because we need the full
AWS SDK + Node's `crypto` for the bearer-token compare.

### `POST /api/clips/initiate`

**Auth:** `Authorization: Bearer ${WIPSHARE_UPLOAD_SECRET}` (required)

**Rate limit:** 30 requests / IP / minute (sliding window, in-memory)

**Body** (JSON):
```ts
{ size_bytes: number;          // int, 1024 ≤ x ≤ 524_288_000
  mime: 'video/mp4';
  width?: number;              // int, 1..10000 (optional, Phase 2B)
  height?: number;             // int, 1..10000 (optional, Phase 2B)
  thumb_size_bytes?: number;   // int, 1..5_000_000 (optional, Phase 2B)
  owner_token?: string;        // 1..100 chars, per-device GUID (optional, Phase 2C) }
```

Every newly created clip is stamped with `expires_at = now + 7 days`. The
optional `owner_token` is stored as-is for a future device-scoped library; it
is never used for auth.

**Response 200:**
```ts
{ data: { id: string;
          uploadUrl: string;            // 15-min presigned R2 PUT (mp4)
          thumbnailUploadUrl: string | null; // 15-min presigned PUT (jpg), null if no thumb requested
          completeUrl: string;          // "/api/clips/{id}/complete"
          viewerUrl: string; } }
```

If `thumb_size_bytes` is provided, `thumbnailUploadUrl` is a presigned PUT for
`clips/{id}.jpg` (Content-Type `image/jpeg`); otherwise it's `null`.

Errors: `invalid_request` (400), `unauthorized` (401), `rate_limited` (429),
`db_error` / `storage_error` (500).

### `POST /api/access/verify`

**Auth:** none (this *is* the auth check). The desktop first-run window calls
it to confirm the invite code the user pasted before storing it.

**Rate limit:** 10 requests / IP / minute (brute-force speed bump) → 429.

**Body** (JSON): `{ code: string }` — the invite code, which is the shared
`WIPSHARE_UPLOAD_SECRET`. Compared constant-time (`crypto.timingSafeEqual`).

**Response 200:** `{ data: { ok: true } }`

Errors: `invalid_code` (401), `invalid_request` (400), `rate_limited` (429).
The attempted code is never logged.

### `POST /api/clips/[id]/complete`

**Auth:** same bearer token.

**Rate limit:** 30 requests / IP / minute.

**Body:** none.

HEADs the R2 mp4 object. On success → `status='ready'` (and updates `size_bytes`
if the actual upload size differs from the declared size). On HEAD failure
or zero-byte upload → `status='failed'`, returns 502.

If the row has a `thumb_r2_key`, also HEADs the thumbnail: if present it's
kept, if missing it's cleared to `null` — **a missing thumbnail never fails
the clip** (best-effort).

**Response 200:**
```ts
{ data: { id: string; status: 'ready'; viewerUrl: string; } }
```

Errors: `not_found` (404), `invalid_state` (409 — already ready/failed),
`upload_not_found` (502 — mp4 missing), `unauthorized` (401), `rate_limited` (429).

### `GET /api/clips/[id]/stream`

**Auth:** none — this powers the public viewer.

Returns **302** with `Location` set to a 7-day presigned R2 GET URL and
`Cache-Control: private, max-age=300`. Returns 404 if the clip is missing or
not yet `ready`.

### `GET /api/clips/[id]/thumb`

**Auth:** none — powers `og:image` and the `<video poster>`.

**Proxies** the thumbnail bytes back directly (not a redirect): `Content-Type:
image/jpeg`, `Cache-Control: public, max-age=86400`. Proxying keeps the URL
stable and non-expiring so link-preview crawlers (Slack, Discord) can fetch it.
Returns 404 if the clip isn't `ready` or has no thumbnail.

## Theme tokens

Defined as Tailwind 4 `@theme` variables in `src/app/globals.css` (WipShare
design system — Inter for UI, JetBrains Mono for values):

| Token                     | Value                    | Tailwind class                  |
| ------------------------- | ------------------------ | ------------------------------- |
| `--color-bg`              | `#08090a`                | `bg-bg`                         |
| `--color-surface`         | `#0f1011`                | `bg-surface`                    |
| `--color-surface-2`       | `#16171a`                | `bg-surface-2`                  |
| `--color-hairline`        | `rgba(255,255,255,0.08)` | `border-hairline`               |
| `--color-hairline-strong` | `rgba(255,255,255,0.14)` | `border-hairline-strong`        |
| `--color-fg`              | `#f7f8f8`                | `text-fg`                       |
| `--color-fg-2`            | `#8a8f98`                | `text-fg-2`                     |
| `--color-fg-3`            | `#62666d`                | `text-fg-3`                     |
| `--color-accent`          | `#5e6ad2`                | `text-accent`, `border-accent`  |
| `--color-accent-hi`       | `#7a85e0`                | `bg-accent-hi`                  |
| `--color-ok/warn/err`     | green / amber / red      | `text-ok`, `text-warn`, …       |
| `--font-sans` / `--font-mono` | Inter / JetBrains Mono | `font-sans` / `font-mono`     |

## Project layout

```
src/
  app/
    layout.tsx                 — Inter font + dark base
    page.tsx                   — landing
    globals.css                — Tailwind 4 + @theme tokens
    c/[id]/
      page.tsx                 — viewer (server component)
      not-found.tsx            — 404 page for /c/[id]
    api/clips/
      initiate/route.ts        — POST: presign upload, insert row
      [id]/complete/route.ts   — POST: HEAD R2, flip status
      [id]/stream/route.ts     — GET: 302 to presigned R2 GET
  components/
    VideoPlayer.tsx
  lib/
    env.ts                     — Zod-validated env
    db.ts                      — Drizzle + Neon HTTP driver
    schema.ts                  — clips table
    r2.ts                      — S3 client + presign + head
    ids.ts                     — 12-char nanoid, custom alphabet
    auth.ts                    — bearer token + timingSafeEqual
    ratelimit.ts               — sliding window, in-memory
    api-response.ts            — ok() / err() envelope helpers
drizzle/
  0000_*.sql                   — initial migration (checked in)
drizzle.config.ts
.env.example
```

## Logging

`console.log` / `console.error` only — Vercel captures both into Function
Logs. Format: `[{route}] {message} key=value key=value`.

Sensitive things never logged: `WIPSHARE_UPLOAD_SECRET`, full presigned URLs
(they contain signed credentials), request bodies that might contain tokens.

## Limitations (intentional Phase 2A non-goals)

By design — don't build any of this in Phase 2A:

- No user accounts, login, signup, magic-link, OAuth
- No workspaces / teams / orgs / permissions
- No clip listing, search, history, "my clips"
- No clip deletion or expiration
- No comments, reactions, drawing on frames
- No email notifications or webhooks
- No analytics
- No custom domain (stay on vercel.app for now)
- No thumbnail generation, no transcoding, no ffmpeg
- No Edge runtime (Node only — bearer compare needs `crypto`)
- No resumable / multipart uploads (single PUT, ≤500 MiB)
- No captions, transcripts, embed widget

The single shared bearer token is a **speed bump**, not real auth — see
`lib/auth.ts`. Real per-user auth lands in Phase 2C.

The in-memory rate limiter resets on every cold start and isn't shared
across concurrent Vercel function instances — see `lib/ratelimit.ts`. A
production limiter would back this with Upstash/Vercel KV/Redis.

## Useful commands

```bash
pnpm dev              # Next dev server (Turbopack)
pnpm build            # production build
pnpm typecheck        # tsc --noEmit (must pass — strict + noUncheckedIndexedAccess)
pnpm lint             # eslint
pnpm db:generate      # generate a new migration from schema changes
pnpm db:migrate       # apply pending migrations to DATABASE_URL
pnpm db:push          # push schema directly (skip migration files — dev only)
pnpm db:studio        # open Drizzle Studio in the browser
```

## Verifying Slack / Discord unfurls

Once deployed:

1. Paste your `https://your-app.vercel.app/c/{id}` link into a Slack channel
   or Discord DM.
2. Slack: should unfurl with title "WipShare clip" and a video player
   (Slack's video unfurl is best-effort for third-party `og:video` —
   sometimes it shows a player, sometimes just the title).
3. Discord: should show the title + description and may embed the video
   inline.

Open Graph debugging: paste the URL into [opengraph.dev](https://www.opengraph.dev/)
or Facebook's [Sharing Debugger](https://developers.facebook.com/tools/debug/).
