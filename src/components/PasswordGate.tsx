'use client';

import { useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { SiteFrame } from '@/components/SiteFrame';

type Props = { clipId: string };

/**
 * The password gate for a public, password-protected clip (clip.html "locked"
 * state). Posts the password to /api/clips/[id]/unlock; on success the server
 * sets a short-lived view-grant cookie and we router.refresh() so the page
 * re-renders into the player. Wrong password shakes + shows the error; the
 * endpoint is rate-limited server-side.
 */
export function PasswordGate({ clipId }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shaking, setShaking] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const password = value.trim();
    if (!password || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/clips/${clipId}/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        // The view-grant cookie is set; re-render server-side to reveal the clip.
        router.refresh();
        return;
      }
      setError(
        res.status === 429
          ? 'Too many tries - wait a minute and try again.'
          : "That password didn't work. Try again.",
      );
      setShaking(true);
      inputRef.current?.select();
    } catch {
      setError('Something went wrong. Try again.');
      setShaking(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SiteFrame>
      <main className="flex flex-1 flex-col items-center px-6">
        <div className="my-[4vh] flex w-[min(94vw,440px)] flex-col items-center text-center">
          <div
            className="flex w-full flex-col items-center gap-1.5 rounded-2xl border border-hairline bg-surface px-[30px] pb-7 pt-[34px]"
            style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 24px 60px rgba(0,0,0,0.4)' }}
          >
            <span
              className="relative mb-3.5 inline-flex h-[52px] w-[52px] items-center justify-center rounded-[14px] border text-[#ab9eff]"
              style={{ background: 'var(--color-pw-dim)', borderColor: 'rgba(139,127,245,0.35)' }}
            >
              <span
                className="pointer-events-none absolute -inset-4 rounded-full"
                style={{ background: 'radial-gradient(circle, var(--color-pw-dim), transparent 70%)' }}
                aria-hidden
              />
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="relative h-6 w-6" aria-hidden>
                <rect x="3" y="7" width="10" height="6.5" rx="1.5" />
                <path d="M5 7V5a3 3 0 0 1 6 0v2" />
              </svg>
            </span>
            <h1 className="text-[19px] font-semibold tracking-[-0.02em] text-fg">This clip is password-protected</h1>
            <p className="max-w-[34ch] text-sm leading-relaxed text-fg-3">
              Ask whoever shared it for the password to watch.
            </p>

            <form onSubmit={onSubmit} autoComplete="off" className="mt-[18px] flex w-full flex-col gap-2.5">
              <input
                ref={inputRef}
                type="password"
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  if (error) setError(null);
                  if (shaking) setShaking(false);
                }}
                onAnimationEnd={() => setShaking(false)}
                placeholder="Enter password"
                aria-label="Password"
                autoFocus
                className={`h-11 w-full rounded-[9px] border bg-bg px-3.5 text-center text-[15px] tracking-[0.02em] text-fg outline-none transition-colors focus:border-accent ${
                  error ? 'border-err' : 'border-hairline'
                } ${shaking ? 'animate-wip-shake' : ''}`}
                style={error ? { boxShadow: '0 0 0 3px rgba(227,93,106,0.2)' } : undefined}
              />
              <div
                className={`flex min-h-4 items-center justify-center gap-1.5 text-[12.5px] text-err transition-opacity ${
                  error ? 'opacity-100' : 'opacity-0'
                }`}
                role={error ? 'alert' : undefined}
              >
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-[13px] w-[13px]" aria-hidden>
                  <circle cx="8" cy="8" r="6" />
                  <path d="M8 5v3.5" />
                  <circle cx="8" cy="11" r="0.5" fill="currentColor" />
                </svg>
                <span>{error ?? ''}</span>
              </div>
              <button
                type="submit"
                disabled={busy}
                className="h-11 w-full rounded-[9px] border border-transparent bg-[#e9eaed] text-sm font-medium text-[#0b0c0d] transition-colors hover:bg-white disabled:opacity-70"
                style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.85), 0 1px 2px rgba(0,0,0,0.4)' }}
              >
                {busy ? 'Unlocking…' : 'Unlock clip'}
              </button>
            </form>
          </div>
          <div className="mt-3.5 text-[13px] text-fg-3">
            Don&apos;t have it?{' '}
            <Link href="/" className="text-fg-2 hover:text-fg">
              Make your own clip
            </Link>
          </div>
        </div>
      </main>
    </SiteFrame>
  );
}
