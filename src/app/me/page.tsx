import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { env } from '@/lib/env';
import { getOwnerToken } from '@/lib/identity';
import { listOwnerClips } from '@/lib/clip-queries';
import { clipDisplayTitle, formatRelative, expiryInfo } from '@/lib/clip-format';
import { SiteFrame } from '@/components/SiteFrame';
import { ClipCard, type ClipCardData } from '@/components/ClipCard';

export const metadata: Metadata = {
  title: 'Your clips — WipShare',
  description: 'Clips saved on this device.',
};

const deviceTag = (
  <span
    className="inline-flex h-[30px] items-center gap-2 rounded-full border border-hairline bg-surface py-0 pl-2 pr-2.5 text-[13px] font-medium text-fg-2"
    title="No account — clips are recognized by a cookie on this device"
  >
    <span className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-[5px] border border-hairline bg-surface-2" aria-hidden>
      <svg viewBox="0 0 12 12" fill="none" className="h-3 w-3">
        <rect x="1" y="1" width="4" height="4" rx="1" fill="var(--color-fg-3)" />
        <rect x="7" y="1" width="4" height="4" rx="1" fill="var(--color-fg-2)" />
        <rect x="1" y="7" width="4" height="4" rx="1" fill="var(--color-fg-2)" />
        <rect x="7" y="7" width="4" height="4" rx="1" fill="var(--color-fg-3)" />
      </svg>
    </span>
    This device
  </span>
);

export default async function MyClipsPage() {
  const owner = await getOwnerToken();
  const rows = owner ? await listOwnerClips(owner) : [];
  const base = env.NEXT_PUBLIC_BASE_URL;

  const cards: ClipCardData[] = rows.map((r) => {
    const exp = expiryInfo(r.expiresAt);
    const soon = exp?.soon ?? false;
    return {
      id: r.id,
      title: clipDisplayTitle(r.title, r.createdAt),
      viewerUrl: `/c/${r.id}`,
      shareUrl: `${base}/c/${r.id}`,
      downloadUrl: `/api/clips/${r.id}/download`,
      thumbUrl: r.thumbR2Key ? `/api/clips/${r.id}/thumb` : null,
      footLabel: soon && exp ? exp.label : formatRelative(r.createdAt),
      footSoon: soon,
    };
  });

  const count = cards.length;

  return (
    <SiteFrame headerRight={deviceTag}>
      <main className="mx-auto w-full max-w-[1160px] flex-1 px-6 pb-16 pt-10">
        <div className="mb-7 flex flex-col gap-[9px]">
          <h1 className="text-[26px] font-medium leading-tight tracking-[-0.02em] text-fg">Your clips</h1>
          <div className="flex flex-wrap items-center gap-[9px] text-[13px] tracking-[-0.005em] text-fg-3">
            <span className="font-medium text-fg-2">{count === 0 ? 'No clips' : `${count} clip${count === 1 ? '' : 's'}`}</span>
            <span className="h-[3px] w-[3px] flex-shrink-0 rounded-full bg-current opacity-45" />
            <span className="inline-flex items-center gap-1.5">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3 opacity-85" aria-hidden>
                <rect x="3" y="7" width="10" height="6" rx="1.5" />
                <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
              </svg>
              Saved on this device
            </span>
            <span className="h-[3px] w-[3px] flex-shrink-0 rounded-full bg-current opacity-45" />
            <span>No account</span>
          </div>
        </div>

        {count === 0 ? (
          <div className="flex flex-col items-center gap-[22px] px-6 py-20 text-center">
            <svg viewBox="0 0 260 180" width="240" height="166" aria-hidden>
              <g strokeLinejoin="round" fill="none">
                <path stroke="rgba(255,255,255,0.10)" d="M 70 150 L 130 178 L 190 150 L 130 122 Z" />
                <path stroke="rgba(255,255,255,0.10)" d="M 70 140 L 130 168 L 190 140 L 130 112 Z" />
                <path stroke="rgba(255,255,255,0.20)" d="M 70 130 L 130 158 L 190 130 L 130 102 Z" />
                <path stroke="rgba(255,255,255,0.32)" d="M 70 120 L 130 148 L 190 120 L 130 92 Z" />
                <path stroke="rgba(255,255,255,0.32)" d="M 86 92 L 130 112 L 174 92 L 130 72 Z" />
                <path stroke="rgba(255,255,255,0.32)" d="M 86 92 L 86 84 L 130 64 L 174 84 L 174 92" />
                <ellipse stroke="rgba(255,255,255,0.32)" cx="130" cy="80" rx="20" ry="5.5" />
                <path stroke="rgba(255,255,255,0.20)" d="M 115 85 L 145 85" />
                <path stroke="rgba(255,255,255,0.20)" d="M 118 89 L 142 89" />
              </g>
            </svg>
            <h2 className="text-xl font-medium tracking-[-0.02em] text-fg">No clips yet</h2>
            <p className="max-w-[42ch] text-sm leading-relaxed text-fg-2">
              Clips you capture from this device show up here automatically — no sign-in. Press the hotkey to make your first one.
            </p>
            <div className="mt-1 inline-flex items-center gap-2.5 rounded-lg border border-hairline bg-surface px-3.5 py-2.5">
              <span className="font-mono text-[11px] uppercase tracking-wide text-fg-3">capture</span>
              <span className="h-[18px] w-px bg-hairline" />
              <span className="inline-flex items-center gap-1">
                <Kbd>Ctrl</Kbd>
                <span className="font-mono text-[11px] text-fg-3 opacity-50">+</span>
                <Kbd>Shift</Kbd>
                <span className="font-mono text-[11px] text-fg-3 opacity-50">+</span>
                <Kbd>R</Kbd>
              </span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(264px,1fr))] gap-[18px]">
            {cards.map((c) => (
              <ClipCard key={c.id} clip={c} />
            ))}
          </div>
        )}
      </main>
    </SiteFrame>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-[22px] min-w-[22px] items-center justify-center rounded border border-hairline border-b-2 bg-surface-2 px-[7px] font-mono text-[11px] leading-none text-fg">
      {children}
    </span>
  );
}
