import { cache } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { clips, type Clip } from '@/lib/schema';
import { env } from '@/lib/env';
import { isValidClipId } from '@/lib/ids';
import { VideoPlayer } from '@/components/VideoPlayer';
import { CopyLinkCard } from '@/components/CopyLinkCard';

type Props = {
  params: Promise<{ id: string }>;
};

// cache() dedupes the DB read across generateMetadata + the page render within
// a single request, so we only hit Postgres once per page view.
const loadClip = cache(async (id: string): Promise<Clip | undefined> => {
  if (!isValidClipId(id)) return undefined;
  try {
    const rows = await db.select().from(clips).where(eq(clips.id, id)).limit(1);
    return rows[0];
  } catch (e) {
    console.error('[viewer] db select failed id=%s err=%s', id, e instanceof Error ? e.message : String(e));
    return undefined;
  }
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const base = env.NEXT_PUBLIC_BASE_URL;
  const pageUrl = `${base}/c/${id}`;
  const videoUrl = `${base}/api/clips/${id}/stream`;
  const description = 'A screen clip shared via WipShare';

  const clip = await loadClip(id);
  const hasThumb = clip?.status === 'ready' && clip.thumbR2Key !== null;
  const w = clip?.width ?? undefined;
  const h = clip?.height ?? undefined;

  // With a thumbnail → proxy URL + clip dimensions. Without → branded static
  // fallback so Slack/Discord always render a card.
  const imageUrl = hasThumb ? `${base}/api/clips/${id}/thumb` : `${base}/og-default.png`;
  const imageW = hasThumb ? w : 1200;
  const imageH = hasThumb ? h : 630;

  return {
    title: 'WipShare clip',
    description,
    openGraph: {
      type: 'video.other',
      url: pageUrl,
      title: 'WipShare clip',
      description,
      videos: [
        {
          url: videoUrl,
          type: 'video/mp4',
          ...(w !== undefined ? { width: w } : {}),
          ...(h !== undefined ? { height: h } : {}),
        },
      ],
      images: [
        {
          url: imageUrl,
          ...(imageW !== undefined ? { width: imageW } : {}),
          ...(imageH !== undefined ? { height: imageH } : {}),
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'WipShare clip',
      description,
      images: [imageUrl],
    },
  };
}

function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

function formatRelative(date: Date): string {
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

/** Coarse expiry label (days; switches to hours + amber under 24h). */
function expiryInfo(expiresAt: Date | null): { label: string; soon: boolean } | null {
  if (!expiresAt) return null;
  const ms = expiresAt.getTime() - Date.now();
  if (ms <= 0) return { label: 'expired', soon: true };
  const dayMs = 86_400_000;
  if (ms < dayMs) {
    const hours = Math.max(1, Math.ceil(ms / 3_600_000));
    return { label: `expires in ${hours} hour${hours === 1 ? '' : 's'}`, soon: true };
  }
  const days = Math.ceil(ms / dayMs);
  return { label: `expires in ${days} day${days === 1 ? '' : 's'}`, soon: false };
}

/** A friendly filename-style default title (we don't store an original name). */
function buildTitle(createdAt: Date): string {
  const y = createdAt.getFullYear();
  const m = (createdAt.getMonth() + 1).toString().padStart(2, '0');
  const d = createdAt.getDate().toString().padStart(2, '0');
  return `wipshare-${y}-${m}-${d}`;
}

export default async function ClipViewerPage({ params }: Props) {
  const { id } = await params;
  const clip = await loadClip(id);
  if (!clip || clip.status !== 'ready') {
    notFound();
  }

  const base = env.NEXT_PUBLIC_BASE_URL;
  const shareUrl = `${base}/c/${id}`;
  const shareDisplay = shareUrl.replace(/^https?:\/\//, '');
  const streamUrl = `/api/clips/${id}/stream`;
  const posterUrl = clip.thumbR2Key !== null ? `/api/clips/${id}/thumb` : undefined;
  const title = buildTitle(clip.createdAt);
  const expiry = expiryInfo(clip.expiresAt ?? null);

  const meta: { k: string; v: string }[] = [];
  if (clip.sizeBytes !== null) meta.push({ k: 'size', v: formatBytes(clip.sizeBytes) });
  if (clip.width !== null && clip.height !== null) meta.push({ k: 'res', v: `${clip.width} × ${clip.height}` });
  if (clip.durationSeconds !== null) meta.push({ k: 'dur', v: `${clip.durationSeconds}s` });
  meta.push({ k: 'type', v: clip.mime });

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden">
      {/* grey corner-origin wash */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{ background: 'radial-gradient(1100px 800px at 100% 0%, rgba(255,255,255,0.05), rgba(255,255,255,0) 70%)' }}
        aria-hidden
      />

      <div className="relative z-[2] flex min-h-screen flex-col">
        <header className="flex items-center justify-between border-b border-hairline px-6 py-[18px]">
          <Link href="/" className="inline-flex items-center gap-[9px] text-base font-medium tracking-tight text-fg" aria-label="WipShare home">
            <span className="relative inline-block h-[22px] w-[22px] rounded-md bg-accent">
              <span className="absolute right-[5px] top-[5px] h-[7px] w-[7px] rounded-full bg-bg" />
            </span>
            <span>wipshare</span>
          </Link>
        </header>

        <main className="flex flex-1 flex-col items-center px-6 pb-8 pt-14">
          <div className="flex w-full max-w-[1080px] flex-col gap-5">
            {/* crumbs */}
            <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-fg-3">
              <span className="rounded border border-hairline bg-surface px-1.5 py-0.5 text-fg-2">c / {id}</span>
              <span className="opacity-60">·</span>
              <span>shared {formatRelative(clip.createdAt)}</span>
              {expiry && (
                <>
                  <span className="opacity-60">·</span>
                  <span className={`inline-flex items-center gap-1.5 ${expiry.soon ? 'text-warn' : 'text-fg-3'}`}>
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3 opacity-70" aria-hidden>
                      <circle cx="8" cy="8" r="6" />
                      <path d="M8 5v3l2 1.5" />
                    </svg>
                    {expiry.label}
                  </span>
                </>
              )}
            </div>

            <VideoPlayer src={streamUrl} poster={posterUrl} />

            {/* title + meta */}
            <div className="mt-1 flex flex-col gap-3">
              <h1 className="text-[22px] font-medium leading-tight tracking-tight text-fg">{title}</h1>
              <div className="flex flex-wrap items-center tabular-nums text-[13px] text-fg-2">
                {meta.map((m, i) => (
                  <span
                    key={m.k}
                    className={`inline-flex items-baseline ${i === 0 ? 'pl-0' : 'pl-3'} ${i === meta.length - 1 ? 'pr-0' : 'border-r border-hairline pr-3'}`}
                  >
                    <span className="mr-1.5 font-mono text-[11px] uppercase tracking-wide text-fg-3">{m.k}</span>
                    <span className="text-fg-2">{m.v}</span>
                  </span>
                ))}
              </div>
            </div>

            <CopyLinkCard url={shareUrl} display={shareDisplay} />
          </div>
        </main>
      </div>
    </div>
  );
}
