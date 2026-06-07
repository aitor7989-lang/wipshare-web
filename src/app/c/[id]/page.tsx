import { cache } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { clips, type Clip } from '@/lib/schema';
import { env } from '@/lib/env';
import { isValidClipId } from '@/lib/ids';
import { getOwnerToken } from '@/lib/identity';
import { clipDisplayTitle, formatBytes, formatRelative, expiryInfo } from '@/lib/clip-format';
import { VideoPlayer } from '@/components/VideoPlayer';
import { SiteFrame } from '@/components/SiteFrame';
import { Unavailable } from '@/components/Unavailable';
import { CopyLinkCard } from '@/components/CopyLinkCard';
import { CopyLinkButton } from '@/components/CopyLinkButton';
import { ClipTitleEditable } from '@/components/ClipTitleEditable';
import { DeleteClipControl } from '@/components/DeleteClipControl';
import { PasswordGate } from '@/components/PasswordGate';
import { ShareControls } from '@/components/ShareControls';
import { hasViewGrant } from '@/lib/view-grant';

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

function isExpired(clip: Clip): boolean {
  return clip.expiresAt !== null && clip.expiresAt.getTime() <= Date.now();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const base = env.NEXT_PUBLIC_BASE_URL;
  const pageUrl = `${base}/c/${id}`;
  const videoUrl = `${base}/api/clips/${id}/stream`;
  const description = 'A screen clip shared via WipShare';

  const clip = await loadClip(id);
  const live = clip?.status === 'ready' && !isExpired(clip);
  const title = live ? clipDisplayTitle(clip.title, clip.createdAt) : 'WipShare clip';
  const hasThumb = live && clip.thumbR2Key !== null;
  const w = clip?.width ?? undefined;
  const h = clip?.height ?? undefined;

  // With a thumbnail → proxy URL + clip dimensions. Without → branded static
  // fallback so Slack/Discord always render a card.
  const imageUrl = hasThumb ? `${base}/api/clips/${id}/thumb` : `${base}/og-default.png`;
  const imageW = hasThumb ? w : 1200;
  const imageH = hasThumb ? h : 630;

  return {
    title: `${title} - WipShare`,
    description,
    openGraph: {
      type: 'video.other',
      url: pageUrl,
      title,
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
      title,
      description,
      images: [imageUrl],
    },
  };
}

const downloadPill =
  'inline-flex h-8 items-center gap-2 rounded-full border border-accent bg-accent px-4 text-[13px] font-medium text-white transition-colors hover:border-accent-hi hover:bg-accent-hi';

const downloadIcon = (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-[13px] w-[13px]" aria-hidden>
    <path d="M8 2v8" />
    <path d="M4.5 7.5L8 11l3.5-3.5" />
    <path d="M3 13h10" />
  </svg>
);

export default async function ClipViewerPage({ params }: Props) {
  const { id } = await params;
  const clip = await loadClip(id);
  if (!clip || clip.status !== 'ready') notFound();

  // Lazy expiry: a past-expires_at clip renders the calm unavailable state.
  if (isExpired(clip)) {
    return <Unavailable />;
  }

  // Ownership decided server-side from the signed cookie - owner-only controls
  // never reach a non-owner.
  const owner = await getOwnerToken();
  const isOwner = clip.ownerToken !== null && owner !== null && owner === clip.ownerToken;

  // Access states for non-owners (the owner always sees the full view, whatever
  // the visibility). Never leak the clip body or its owner_token here.
  if (!isOwner) {
    if (clip.visibility === 'private') {
      return (
        <Unavailable
          title="This clip is private"
          sub="The person who made it hasn't shared it publicly. Ask them for a link if you think you should have access."
        />
      );
    }
    // Public + password: only viewers who've cleared the gate (a valid signed
    // view-grant cookie) get the player; everyone else gets the gate.
    if (clip.passwordHash !== null && !(await hasViewGrant(id))) {
      return <PasswordGate clipId={id} />;
    }
  }

  const base = env.NEXT_PUBLIC_BASE_URL;
  const shareUrl = `${base}/c/${id}`;
  const shareDisplay = shareUrl.replace(/^https?:\/\//, '');
  const streamUrl = `/api/clips/${id}/stream`;
  const downloadUrl = `/api/clips/${id}/download`;
  const posterUrl = clip.thumbR2Key !== null ? `/api/clips/${id}/thumb` : undefined;
  const title = clipDisplayTitle(clip.title, clip.createdAt);
  const expiry = expiryInfo(clip.expiresAt ?? null);

  const meta: { k: string; v: string }[] = [];
  if (clip.sizeBytes !== null) meta.push({ k: 'size', v: formatBytes(clip.sizeBytes) });
  if (clip.width !== null && clip.height !== null) meta.push({ k: 'res', v: `${clip.width} × ${clip.height}` });
  if (clip.durationSeconds !== null) meta.push({ k: 'dur', v: `${clip.durationSeconds}s` });
  meta.push({ k: 'type', v: clip.mime });

  const headerRight = isOwner ? (
    <div className="flex items-center gap-3">
      <Link
        href="/me"
        className="inline-flex h-[30px] items-center gap-2 rounded-full border border-hairline bg-surface py-0 pl-2 pr-2.5 text-[13px] font-medium text-fg-2 transition-colors hover:border-hairline-strong hover:text-fg"
      >
        <span className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-[5px] border border-hairline bg-surface-2" aria-hidden>
          <svg viewBox="0 0 12 12" fill="none" className="h-3 w-3">
            <rect x="1" y="1" width="4" height="4" rx="1" fill="var(--color-fg-3)" />
            <rect x="7" y="1" width="4" height="4" rx="1" fill="var(--color-fg-2)" />
            <rect x="1" y="7" width="4" height="4" rx="1" fill="var(--color-fg-2)" />
            <rect x="7" y="7" width="4" height="4" rx="1" fill="var(--color-fg-3)" />
          </svg>
        </span>
        Your clips
      </Link>
      <ShareControls
        clipId={id}
        initialVisibility={clip.visibility}
        initialHasPassword={clip.passwordHash !== null}
        shareUrl={shareUrl}
        expiryLabel={expiry?.label ?? null}
      />
    </div>
  ) : (
    <span className="inline-flex items-center gap-[7px] font-mono text-xs text-fg-3">
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-[13px] w-[13px] opacity-80" aria-hidden>
        <path d="M5.5 8.5l5-3M5.5 7.5l5 3" />
        <circle cx="4" cy="8" r="2" />
        <circle cx="12" cy="4.5" r="2" />
        <circle cx="12" cy="11.5" r="2" />
      </svg>
      shared with you
    </span>
  );

  return (
    <SiteFrame headerRight={headerRight}>
      <main className="flex flex-1 flex-col items-center px-6 pb-8 pt-14">
        <div className="flex w-full max-w-[1080px] flex-col gap-5">
          {/* crumbs */}
          <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-fg-3">
            <span className="rounded border border-hairline bg-surface px-1.5 py-0.5 text-fg-2">c / {id}</span>
            <span className="opacity-60">·</span>
            <span>shared {formatRelative(clip.createdAt)}</span>
            {expiry ? (
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
            ) : null}
          </div>

          <VideoPlayer src={streamUrl} poster={posterUrl} width={clip.width ?? undefined} height={clip.height ?? undefined} />

          {/* title + meta + actions */}
          <div className="mt-1 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
            <div className="min-w-0">
              {isOwner ? (
                <ClipTitleEditable clipId={id} initialTitle={title} />
              ) : (
                <h1 className="text-[22px] font-medium leading-tight tracking-[-0.02em] text-fg">{title}</h1>
              )}
              <div className="mt-2.5 flex flex-wrap items-center tabular-nums text-[13px] text-fg-2">
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

            <div className="flex items-center gap-2">
              {isOwner ? (
                <DeleteClipControl clipId={id} title={title} />
              ) : (
                <CopyLinkButton url={shareUrl} />
              )}
              <a href={downloadUrl} download className={downloadPill}>
                {downloadIcon}
                Download
              </a>
            </div>
          </div>

          {/* owner: the click-to-copy URL card (visitors copy via the button above) */}
          {isOwner ? <CopyLinkCard url={shareUrl} display={shareDisplay} /> : null}
        </div>
      </main>
    </SiteFrame>
  );
}
