'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DeleteConfirmDialog } from './DeleteConfirmDialog';

type Props = {
  clipId: string;
  title: string;
};

/**
 * Owner-only delete on the viewer: a quiet danger button + the shared confirm
 * dialog. On confirm it DELETEs and routes to /me. The server enforces ownership
 * (403 for non-owners); a 404 is treated as already-gone (also routes to /me).
 */
export function DeleteClipControl({ clipId, title }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

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
      <DeleteConfirmDialog
        open={open}
        title={title}
        busy={busy}
        onCancel={() => setOpen(false)}
        onConfirm={doDelete}
      />
    </>
  );
}
