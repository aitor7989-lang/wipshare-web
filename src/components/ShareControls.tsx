'use client';

import { useEffect, useRef, useState } from 'react';

type Visibility = 'public' | 'private';

type Props = {
  clipId: string;
  initialVisibility: Visibility;
  initialHasPassword: boolean;
  /** The canonical share URL (always the plain /c/[id]). */
  shareUrl: string;
  /** e.g. "Expires in 6 days" - shown in the popover footer. */
  expiryLabel?: string | null;
};

type PatchResult = { visibility: Visibility; hasPassword: boolean };

/**
 * Owner-only sharing controls (viewer.html share popover). A capsule shows the
 * current state - Public / Password / Private - and opens a popover with:
 *   • "Anyone with the link" public/private toggle  → PATCH { visibility }
 *   • "Password protect" toggle + field             → PATCH { password }
 * Updates are optimistic and reconciled from the PATCH response (revert on
 * failure). Private supersedes - the password control is disabled and cleared
 * when private. Authorization is enforced server-side; this is just the UI.
 *
 * (Per this phase's brief, the design's Embed dialog and GIF download are out of
 * scope and intentionally omitted.)
 */
export function ShareControls({ clipId, initialVisibility, initialHasPassword, shareUrl, expiryLabel }: Props) {
  const [visibility, setVisibility] = useState<Visibility>(initialVisibility);
  const [hasPassword, setHasPassword] = useState(initialHasPassword);
  const [passwordOn, setPasswordOn] = useState(initialHasPassword);
  const [draft, setDraft] = useState('');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const wrapRef = useRef<HTMLDivElement>(null);
  const passInputRef = useRef<HTMLInputElement>(null);

  async function patch(body: Record<string, unknown>): Promise<PatchResult | null> {
    try {
      const res = await fetch(`/api/clips/${clipId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) return null;
      const json: unknown = await res.json();
      const data = (json as { data?: PatchResult } | null)?.data;
      return data ?? null;
    } catch {
      return null;
    }
  }

  async function commitPassword() {
    const pw = draft.trim();
    if (!pw || busy) return;
    setBusy(true);
    const data = await patch({ password: pw });
    setBusy(false);
    if (data) {
      setHasPassword(data.hasPassword);
      setJustSaved(true);
    }
  }

  function closePop() {
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) closePop();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePop();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
    // closePop closes over draft/passwordOn/visibility/hasPassword - re-bind when they change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, draft, passwordOn, visibility, hasPassword]);

  async function onToggleVisibility() {
    if (busy) return;
    const next: Visibility = visibility === 'public' ? 'private' : 'public';
    const prev = { visibility, hasPassword, passwordOn };
    // Optimistic. Going private clears the password (server enforces the same).
    setVisibility(next);
    if (next === 'private') {
      setPasswordOn(false);
      setHasPassword(false);
      setDraft('');
      setJustSaved(false);
    }
    setBusy(true);
    const data = await patch({ visibility: next });
    setBusy(false);
    if (!data) {
      setVisibility(prev.visibility);
      setHasPassword(prev.hasPassword);
      setPasswordOn(prev.passwordOn);
      return;
    }
    setVisibility(data.visibility);
    setHasPassword(data.hasPassword);
    if (data.visibility === 'private' || !data.hasPassword) setPasswordOn(data.visibility === 'public' && data.hasPassword);
  }

  async function onTogglePassword() {
    if (busy || visibility !== 'public') return;
    if (!passwordOn) {
      setPasswordOn(true);
      window.setTimeout(() => passInputRef.current?.focus(), 0);
      return;
    }
    // Turning the password off → clear it.
    setPasswordOn(false);
    setDraft('');
    setJustSaved(false);
    if (hasPassword) {
      const prev = hasPassword;
      setHasPassword(false);
      setBusy(true);
      const data = await patch({ password: null });
      setBusy(false);
      if (!data) {
        setHasPassword(prev);
        setPasswordOn(true);
      } else {
        setHasPassword(data.hasPassword);
      }
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      // clipboard blocked - no-op
    }
  }

  const label = visibility === 'private' ? 'Private' : hasPassword ? 'Password' : 'Public';
  const dotStyle =
    visibility === 'private'
      ? { background: 'var(--color-fg-3)' }
      : hasPassword
        ? { background: 'var(--color-pw)', boxShadow: '0 0 0 3px var(--color-pw-dim)' }
        : { background: 'var(--color-ok)', boxShadow: '0 0 0 3px rgba(63,185,80,0.14)' };

  const draftTrimmed = draft.trim();
  const passwordSet = justSaved || (hasPassword && draftTrimmed.length === 0);
  const passHint = passwordSet
    ? 'Password set · required to watch.'
    : hasPassword && draftTrimmed.length > 0
      ? 'Press Update to change the password.'
      : 'Anyone with the link will need this to watch.';

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => (open ? closePop() : setOpen(true))}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="inline-flex h-[30px] items-center gap-2 rounded-full border border-hairline bg-surface px-2.5 font-mono text-xs text-fg-2 transition-colors hover:border-hairline-strong hover:text-fg"
      >
        <span className="h-1.5 w-1.5 rounded-full" style={dotStyle} aria-hidden />
        <span>{label}</span>
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={`h-[11px] w-[11px] opacity-70 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden>
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Sharing settings"
          className="absolute right-0 top-[calc(100%+10px)] z-[70] w-80 rounded-[14px] border border-hairline-strong p-2.5 pb-1"
          style={{
            background: 'rgba(8,9,10,0.72)',
            backdropFilter: 'blur(20px) saturate(1.4)',
            WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
            boxShadow: '0 20px 48px rgba(0,0,0,0.5)',
          }}
        >
          <div className="rounded-[10px] border border-hairline bg-surface p-1">
            <div className="flex items-center justify-between gap-3 rounded-[7px] p-2.5 hover:bg-surface-2">
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-[13px] font-medium text-fg">Anyone with the link</span>
                <span className="text-xs text-fg-3">
                  {visibility === 'public' ? 'Public · no sign-in needed' : 'Only you can open this link'}
                </span>
              </div>
              <Toggle on={visibility === 'public'} onToggle={onToggleVisibility} label="Make clip public" />
            </div>

            <div className="flex items-center justify-between gap-3 rounded-[7px] p-2.5 hover:bg-surface-2">
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-[13px] font-medium text-fg">Password protect</span>
                <span className="text-xs text-fg-3">Require a password to view</span>
              </div>
              <Toggle
                on={passwordOn}
                onToggle={onTogglePassword}
                disabled={visibility !== 'public'}
                label="Require a password"
              />
            </div>

            {visibility === 'public' && passwordOn ? (
              <div className="px-2.5 pb-2">
                <div className="flex items-center gap-1.5">
                  <input
                    ref={passInputRef}
                    type="text"
                    value={draft}
                    onChange={(e) => {
                      setDraft(e.target.value);
                      if (justSaved) setJustSaved(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && draftTrimmed) {
                        e.preventDefault();
                        void commitPassword();
                      }
                    }}
                    placeholder="Set a password"
                    aria-label="Clip password"
                    className="h-8 min-w-0 flex-1 rounded-md border border-hairline bg-bg px-2.5 font-mono text-[13px] text-fg outline-none transition-colors focus:border-accent"
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={() => void commitPassword()}
                    disabled={!draftTrimmed || busy || justSaved}
                    className={`h-8 shrink-0 rounded-md border px-3 text-xs font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_1px_2px_rgba(0,0,0,0.4)] transition-colors disabled:cursor-default disabled:opacity-40 ${
                      justSaved ? 'border-transparent bg-ok text-white' : 'border-transparent bg-[#e9eaed] text-[#0b0c0d] hover:bg-white'
                    }`}
                  >
                    {justSaved || !hasPassword ? 'Set' : 'Update'}
                  </button>
                </div>
                <div className={`mt-1.5 flex min-h-[14px] items-center gap-1.5 text-[11px] ${passwordSet ? 'text-ok' : 'text-fg-3'}`}>
                  {passwordSet ? (
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3 shrink-0" aria-hidden>
                      <path d="M3 8.5l3.5 3.5L13 4.5" />
                    </svg>
                  ) : null}
                  <span>{passHint}</span>
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex items-center justify-between gap-3 px-3 pb-3.5 pt-3">
            <span className="text-xs text-fg-3">{expiryLabel ?? ''}</span>
            <button
              type="button"
              onClick={copyLink}
              className="shrink-0 text-[13px] font-medium text-accent-hi transition-colors hover:text-fg"
            >
              {copied ? 'Copied' : 'Copy link'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Toggle({
  on,
  onToggle,
  disabled,
  label,
}: {
  on: boolean;
  onToggle: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onToggle}
      disabled={disabled}
      className={`relative h-[18px] w-[30px] shrink-0 rounded-full border transition-colors ${
        on ? 'border-accent bg-accent' : 'border-hairline bg-surface-2'
      } ${disabled ? 'pointer-events-none opacity-40' : ''}`}
    >
      <span
        className={`absolute left-0.5 top-0.5 h-3 w-3 rounded-full transition-transform ${
          on ? 'translate-x-3 bg-[#0b0c0d]' : 'bg-fg-2'
        }`}
      />
    </button>
  );
}
