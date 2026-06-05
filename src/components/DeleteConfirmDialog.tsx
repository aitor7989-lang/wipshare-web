'use client';

import { useEffect, useRef } from 'react';

type Props = {
  open: boolean;
  /** The clip's name, shown quoted in the prompt. */
  title: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

/**
 * Shared "Delete this clip?" confirm dialog (me.html). Frosted panel over a
 * dimmed backdrop; the destructive button is focused on open, Enter confirms,
 * Esc / backdrop-click cancels. Used by the viewer's owner controls and the
 * library cards.
 */
export function DeleteConfirmDialog({ open, title, busy, onCancel, onConfirm }: Props) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) confirmRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Delete clip"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          if (!busy) onCancel();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          onConfirm();
        }
      }}
    >
      <button
        type="button"
        aria-label="Cancel"
        tabIndex={-1}
        onClick={() => !busy && onCancel()}
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
            onClick={() => !busy && onCancel()}
            className="inline-flex h-8 items-center rounded-md border border-hairline bg-surface px-[13px] text-[13px] font-medium text-fg transition-colors hover:border-hairline-strong hover:bg-surface-2"
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="inline-flex h-8 items-center rounded-md border px-[13px] text-[13px] font-medium text-white transition-colors disabled:opacity-70"
            style={{ background: '#c83a48', borderColor: '#c83a48', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.14)' }}
          >
            {busy ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
