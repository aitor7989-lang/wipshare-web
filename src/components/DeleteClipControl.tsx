'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type Props = {
  clipId: string;
  title: string;
};

/**
 * Owner-only delete: a quiet danger button that opens a confirm dialog. On
 * confirm it DELETEs the clip and routes to /me. The server enforces ownership
 * (403 for non-owners); a 404 is treated as already-gone (also routes to /me).
 */
export function DeleteClipControl({ clipId, title }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) confirmRef.current?.focus();
  }, [open]);

  const doDelete = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/clips/${clipId}`, { method: 'DELETE' });
      if (res.ok || res.status === 404) {
        router.push('/me');
        router.refresh();
        return;
      }
    } catch {
      // fall through to re-enable the button below
    }
    setBusy(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Delete clip"
        className="inline-flex h-8 items-center gap-2 rounded-md border border-hairline bg-surface px-3 text-[13px] font-medium text-fg-2 transition-colors hover:border-err hover:bg-surface-2 hover:text-err"
      >
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-[13px] w-[13px]" aria-hidden>
          <path d="M3 5h10" />
          <path d="M5 5v8a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1V5" />
          <path d="M6 5V3h4v2" />
        </svg>
        Delete
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Delete clip"
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              if (!busy) setOpen(false);
            } else if (e.key === 'Enter') {
              e.preventDefault();
              void doDelete();
            }
          }}
        >
          <button
            type="button"
            aria-label="Cancel"
            tabIndex={-1}
            onClick={() => !busy && setOpen(false)}
            className="absolute inset-0 cursor-default"
            style={{ background: 'rgba(4,5,6,0.55)', backdropFilter: 'blur(2px)' }}
          />
          <div
            className="relative z-[1] flex w-[380px] max-w-full flex-col gap-2 rounded-2xl border border-hairline-strong p-5"
            style={{ background: 'rgba(20,21,23,0.92)', backdropFilter: 'blur(20px) saturate(1.4)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 18px 50px rgba(0,0,0,0.55)' }}
          >
            <span className="text-[15px] font-semibold tracking-[-0.01em] text-fg">Delete this clip?</span>
            <span className="text-[13px] leading-relaxed text-fg-3">
              <span className="font-medium text-fg">“{title}”</span> and its share link will stop working.{' '}
              <span className="text-fg-3">You can’t undo this.</span>
            </span>
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => !busy && setOpen(false)}
                className="inline-flex h-8 items-center rounded-md border border-hairline bg-surface px-[13px] text-[13px] font-medium text-fg transition-colors hover:border-hairline-strong hover:bg-surface-2"
              >
                Cancel
              </button>
              <button
                ref={confirmRef}
                type="button"
                onClick={doDelete}
                disabled={busy}
                className="inline-flex h-8 items-center rounded-md border px-[13px] text-[13px] font-medium text-white transition-colors disabled:opacity-70"
                style={{ background: '#c83a48', borderColor: '#c83a48', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.14)' }}
              >
                {busy ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
