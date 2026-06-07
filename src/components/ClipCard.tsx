'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DeleteConfirmDialog } from './DeleteConfirmDialog';

export type ClipCardData = {
  id: string;
  title: string;
  viewerUrl: string;
  shareUrl: string;
  downloadUrl: string;
  thumbUrl: string | null;
  footLabel: string;
  footSoon: boolean;
  visibility: 'public' | 'private';
  hasPassword: boolean;
};

const menuItem =
  'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] font-medium text-fg transition-colors hover:bg-surface-2';

/** A library clip card: poster + hover Open/Copy, title, age/expiry, and a
 *  kebab menu (Copy link · Download · Delete). Delete confirms then re-fetches. */
export function ClipCard({ clip }: { clip: ClipCardData }) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [menuOpen]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(clip.shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      // clipboard blocked — no-op
    }
  };

  const doDelete = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/clips/${clip.id}`, { method: 'DELETE' });
      if (res.ok || res.status === 404) {
        setConfirmOpen(false);
        router.refresh();
        return;
      }
    } catch {
      // fall through to re-enable
    }
    setBusy(false);
  };

  return (
    <div
      className="group relative flex flex-col overflow-hidden rounded-xl border border-hairline bg-surface transition-all duration-150 hover:-translate-y-[3px] hover:border-hairline-strong"
      style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)' }}
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-[#0a0b0c]">
        <Link href={clip.viewerUrl} aria-label={`Open ${clip.title}`} className="absolute inset-0 block">
          {clip.thumbUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={clip.thumbUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <span
              className="block h-full w-full"
              style={{ background: 'radial-gradient(72% 92% at 22% 28%, rgba(94,106,210,0.18), transparent 66%), linear-gradient(155deg, #15171e, #0a0b0e)' }}
            />
          )}
        </Link>
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
          style={{ background: 'rgba(8,9,10,0.4)', backdropFilter: 'blur(3px)' }}
        >
          <Link
            href={clip.viewerUrl}
            className="pointer-events-auto inline-flex h-8 items-center gap-1.5 rounded-md border border-accent bg-accent px-3 text-[13px] font-medium text-white transition-colors hover:border-accent-hi hover:bg-accent-hi"
            style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18)' }}
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden>
              <path d="M3 8h10" />
              <path d="M9 4l4 4-4 4" />
            </svg>
            Open
          </Link>
          <button
            type="button"
            onClick={copy}
            className="pointer-events-auto inline-flex h-8 items-center gap-1.5 rounded-md border border-hairline-strong px-3 text-[13px] font-medium text-fg transition-colors hover:bg-surface-2"
            style={{ background: 'rgba(15,16,17,0.9)' }}
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden>
              <rect x="5" y="5" width="8" height="8" rx="1.5" />
              <path d="M3 11V4a1 1 0 0 1 1-1h7" />
            </svg>
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-[11px] px-3.5 pb-[15px] pt-[13px]">
        <div className="flex items-start justify-between gap-2">
          <Link href={clip.viewerUrl} className="overflow-hidden text-ellipsis whitespace-nowrap text-sm font-medium tracking-[-0.005em] text-fg">
            {clip.title}
          </Link>
          <button
            type="button"
            aria-label="More"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
            className="-mr-1 -mt-[3px] inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md text-fg-3 transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4" aria-hidden>
              <circle cx="8" cy="3.5" r="1.55" />
              <circle cx="8" cy="8" r="1.55" />
              <circle cx="8" cy="12.5" r="1.55" />
            </svg>
          </button>
        </div>
        <div className="flex items-center justify-between gap-2">
          <VisBadge visibility={clip.visibility} hasPassword={clip.hasPassword} />
          <span className={`font-mono text-[11px] tabular-nums ${clip.footSoon ? 'text-warn' : 'text-fg-3'}`}>{clip.footLabel}</span>
        </div>
      </div>

      {menuOpen ? (
        <div
          className="absolute right-3 top-[38px] z-20 flex w-[180px] flex-col gap-px rounded-[10px] border border-hairline-strong p-[5px]"
          style={{ background: 'rgba(8,9,10,0.72)', backdropFilter: 'blur(20px) saturate(1.4)', boxShadow: '0 16px 40px rgba(0,0,0,0.5)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <button type="button" onClick={() => { setMenuOpen(false); void copy(); }} className={menuItem}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 text-fg-2" aria-hidden>
              <rect x="5" y="5" width="8" height="8" rx="1.5" />
              <path d="M3 11V4a1 1 0 0 1 1-1h7" />
            </svg>
            Copy link
          </button>
          <a href={clip.downloadUrl} download onClick={() => setMenuOpen(false)} className={menuItem}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 text-fg-2" aria-hidden>
              <path d="M8 2v8" />
              <path d="M4.5 7.5L8 11l3.5-3.5" />
              <path d="M3 13h10" />
            </svg>
            Download
          </a>
          <div className="mx-2 my-1 h-px bg-hairline" />
          <button type="button" onClick={() => { setMenuOpen(false); setConfirmOpen(true); }} className={`${menuItem} text-err hover:text-err`}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 text-err" aria-hidden>
              <path d="M3 5h10" />
              <path d="M5 5v8a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1V5" />
              <path d="M6 5V3h4v2" />
            </svg>
            Delete
          </button>
        </div>
      ) : null}

      <DeleteConfirmDialog
        open={confirmOpen}
        title={clip.title}
        busy={busy}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={doDelete}
      />
    </div>
  );
}

/** The visibility badge (me.html .vis): Public (green) / Private (grey) /
 *  Password (accent). "Password" = a public clip with a password set. */
function VisBadge({ visibility, hasPassword }: { visibility: 'public' | 'private'; hasPassword: boolean }) {
  const kind = visibility === 'private' ? 'private' : hasPassword ? 'password' : 'public';
  const cfg = {
    public: { label: 'Public', text: 'text-[#7bd389]', dot: { background: 'var(--color-ok)', boxShadow: '0 0 0 3px rgba(63,185,80,0.14)' } },
    private: { label: 'Private', text: 'text-fg-2', dot: { background: 'var(--color-fg-3)' } },
    password: { label: 'Password', text: 'text-accent-hi', dot: { background: 'var(--color-accent)', boxShadow: '0 0 0 3px var(--color-accent-dim)' } },
  }[kind];
  return (
    <span className={`-ml-0.5 inline-flex h-[22px] shrink-0 items-center gap-1.5 rounded-full border border-hairline bg-surface-2 pl-2 pr-[9px] text-[11.5px] font-medium ${cfg.text}`}>
      <span className="h-1.5 w-1.5 rounded-full" style={cfg.dot} aria-hidden />
      {cfg.label}
    </span>
  );
}
