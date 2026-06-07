'use client';

import { useEffect, useRef, useState } from 'react';

type Props = {
  open: boolean;
  clipTitle: string;
  hasPassword: boolean;
  busy?: boolean;
  onCancel: () => void;
  onSave: (password: string) => void;
  onRemove: () => void;
};

/**
 * The /me "Password protect" / "Change password" dialog (me.html). Owner types a
 * password and Sets/Updates it, or removes an existing one. Enter saves, Esc
 * cancels. The actual PATCH + refresh is handled by the caller.
 */
export function PasswordDialog({ open, clipTitle, hasPassword, busy, onCancel, onSave, onRemove }: Props) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setValue('');
    const t = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;
  const v = value.trim();

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6" role="dialog" aria-modal="true" aria-label={hasPassword ? 'Change password' : 'Password protect'}>
      <button
        type="button"
        aria-label="Cancel"
        onClick={onCancel}
        className="absolute inset-0 cursor-default"
        style={{ background: 'rgba(4,5,6,0.55)', backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)' }}
      />
      <div
        className="relative z-10 flex w-[380px] max-w-full flex-col gap-2 rounded-2xl border border-hairline-strong p-5"
        style={{
          background: 'rgba(20,21,23,0.92)',
          backdropFilter: 'blur(20px) saturate(1.4)',
          WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 18px 50px rgba(0,0,0,0.55)',
        }}
      >
        <span className="text-[15px] font-semibold tracking-[-0.01em] text-fg">
          {hasPassword ? 'Change password' : 'Password protect'}
        </span>
        <span className="text-[13px] leading-relaxed text-fg-3">
          Anyone with the link to <span className="font-medium text-fg">&ldquo;{clipTitle}&rdquo;</span> will need this password to watch.
        </span>
        <div className="mt-1.5 flex items-center gap-1.5">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && v) {
                e.preventDefault();
                onSave(v);
              }
            }}
            placeholder="Set a password"
            aria-label="Password"
            autoComplete="off"
            className="h-9 min-w-0 flex-1 rounded-lg border border-hairline bg-bg px-[11px] font-mono text-[13px] tracking-[0.02em] text-fg outline-none transition-colors focus:border-accent"
          />
        </div>
        <div className="mt-3 flex items-center justify-end gap-2">
          {hasPassword ? (
            <button
              type="button"
              onClick={onRemove}
              disabled={busy}
              className="mr-auto inline-flex h-8 items-center rounded-md border border-transparent bg-transparent px-3 text-[13px] font-medium text-fg-3 transition-colors hover:bg-[rgba(227,93,106,0.12)] hover:text-err disabled:opacity-50"
            >
              Remove password
            </button>
          ) : null}
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="inline-flex h-8 items-center rounded-md border border-hairline bg-surface px-[13px] text-[13px] font-medium text-fg transition-colors hover:border-hairline-strong hover:bg-surface-2 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(v)}
            disabled={!v || busy}
            className="inline-flex h-8 items-center rounded-md border border-transparent bg-[#e9eaed] px-[13px] text-[13px] font-medium text-[#0b0c0d] shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_1px_2px_rgba(0,0,0,0.4)] transition-colors hover:bg-white disabled:cursor-not-allowed disabled:border-hairline disabled:bg-surface-2 disabled:text-fg-3 disabled:shadow-none"
          >
            {hasPassword ? 'Update' : 'Set password'}
          </button>
        </div>
      </div>
    </div>
  );
}
