'use client';

import { useState } from 'react';

type Props = {
  /** The canonical share URL to copy (always the plain /c/[id]). */
  url: string;
};

/** Visitor "Copy link" ghost button — copies the share URL with a flash. */
export function CopyLinkButton({ url }: Props) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      // Clipboard blocked (insecure context / permissions) — no-op.
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex h-8 items-center gap-2 rounded-md border border-transparent bg-transparent px-3 text-[13px] font-medium text-fg-2 transition-colors hover:border-hairline hover:bg-surface-2 hover:text-fg"
    >
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-[13px] w-[13px]" aria-hidden>
        <rect x="5" y="5" width="8" height="8" rx="1.5" />
        <path d="M3 11V4a1 1 0 0 1 1-1h7" />
      </svg>
      {copied ? 'Copied' : 'Copy link'}
    </button>
  );
}
