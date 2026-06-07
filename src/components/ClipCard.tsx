'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DeleteConfirmDialog } from './DeleteConfirmDialog';
import { PasswordDialog } from './PasswordDialog';

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

/** Derived display/filter category: private, password (public + a password), or public. */
export function clipCategory(c: { visibility: 'public' | 'private'; hasPassword: boolean }): 'public' | 'private' | 'password' {
  if (c.visibility === 'private') return 'private';
  return c.hasPassword ? 'password' : 'public';
}

const menuItem =
  'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] font-medium text-fg transition-colors hover:bg-surface-2';

/** A library clip card: poster + hover Open/Copy, title, badge, age/expiry, and a
 *  kebab menu (Copy link · Download · Make public/private · Set/Change password ·
 *  Delete). Visibility/password changes PATCH then re-fetch the list. */
export function ClipCard({ clip }: { clip: ClipCardData }) {
  const router = useRouter();
  const kebabRef = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const category = clipCategory(clip);

  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('click', close);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [menuOpen]);

  const openMenu = () => {
    const el = kebabRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const MW = 180;
    const MH = 232;
    const left = Math.max(8, Math.min(r.right - MW, window.innerWidth - MW - 8));
    let top = r.bottom + 6;
    if (top + MH > window.innerHeight - 8) top = Math.max(8, r.top - MH - 6);
    setMenuPos({ top, left });
    setMenuOpen(true);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(clip.shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      // clipboard blocked - no-op
    }
  };

  async function patchClip(body: Record<string, unknown>): Promise<boolean> {
    if (busy) return false;
    setBusy(true);
    try {
      const res = await fetch(`/api/clips/${clip.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        router.refresh();
        setBusy(false);
        return true;
      }
    } catch {
      // fall through
    }
    setBusy(false);
    return false;
  }

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
            ref={kebabRef}
            type="button"
            aria-label="More"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={(e) => {
              e.stopPropagation();
              if (menuOpen) setMenuOpen(false);
              else openMenu();
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

      {menuOpen && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="fixed z-[120] flex w-[180px] flex-col gap-px rounded-[10px] border border-hairline-strong p-[5px]"
              style={{
                top: menuPos.top,
                left: menuPos.left,
                background: 'rgba(8,9,10,0.72)',
                backdropFilter: 'blur(20px) saturate(1.4)',
                WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
                boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
              }}
              role="menu"
              onClick={(e) => e.stopPropagation()}
            >
              <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); void copy(); }} className={menuItem}>
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 text-fg-2" aria-hidden>
                  <rect x="5" y="5" width="8" height="8" rx="1.5" />
                  <path d="M3 11V4a1 1 0 0 1 1-1h7" />
                </svg>
                Copy link
              </button>
              <a href={clip.downloadUrl} download role="menuitem" onClick={() => setMenuOpen(false)} className={menuItem}>
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 text-fg-2" aria-hidden>
                  <path d="M8 2v8" />
                  <path d="M4.5 7.5L8 11l3.5-3.5" />
                  <path d="M3 13h10" />
                </svg>
                Download
              </a>
              <div className="mx-2 my-1 h-px bg-hairline" />
              <button
                type="button"
                role="menuitem"
                onClick={() => { setMenuOpen(false); void patchClip({ visibility: category === 'private' ? 'public' : 'private' }); }}
                className={menuItem}
              >
                {category === 'private' ? (
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 text-fg-2" aria-hidden>
                    <path d="M2 8s2.5-4.5 6-4.5S14 8 14 8s-2.5 4.5-6 4.5S2 8 2 8z" />
                    <circle cx="8" cy="8" r="1.6" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 text-fg-2" aria-hidden>
                    <rect x="3" y="7" width="10" height="6" rx="1.5" />
                    <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
                  </svg>
                )}
                {category === 'private' ? 'Make public' : 'Make private'}
              </button>
              <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); setPwOpen(true); }} className={menuItem}>
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 text-fg-2" aria-hidden>
                  <rect x="3" y="7" width="10" height="6" rx="1.5" />
                  <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
                  <circle cx="8" cy="10" r="0.6" fill="currentColor" />
                </svg>
                {category === 'password' ? 'Change password' : 'Set password'}
              </button>
              <div className="mx-2 my-1 h-px bg-hairline" />
              <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); setConfirmOpen(true); }} className={`${menuItem} text-err hover:text-err`}>
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 text-err" aria-hidden>
                  <path d="M3 5h10" />
                  <path d="M5 5v8a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1V5" />
                  <path d="M6 5V3h4v2" />
                </svg>
                Delete
              </button>
            </div>,
            document.body,
          )
        : null}

      <DeleteConfirmDialog
        open={confirmOpen}
        title={clip.title}
        busy={busy}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={doDelete}
      />

      <PasswordDialog
        open={pwOpen}
        clipTitle={clip.title}
        hasPassword={clip.hasPassword}
        busy={busy}
        onCancel={() => setPwOpen(false)}
        onSave={(pw) => {
          setPwOpen(false);
          void patchClip({ visibility: 'public', password: pw });
        }}
        onRemove={() => {
          setPwOpen(false);
          void patchClip({ password: null });
        }}
      />
    </div>
  );
}

/** The visibility badge (me.html .vis): Public (green) / Private (grey) /
 *  Password (accent). "Password" = a public clip with a password set. */
function VisBadge({ visibility, hasPassword }: { visibility: 'public' | 'private'; hasPassword: boolean }) {
  const kind = clipCategory({ visibility, hasPassword });
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
