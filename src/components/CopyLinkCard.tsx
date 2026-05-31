'use client';

import { useState } from 'react';

type Props = {
  /** The full canonical URL copied to the clipboard. */
  url: string;
  /** The shorter display string shown in the card (e.g. host + path). */
  display: string;
};

/** The clickable "URL · …· Copy" card. Copies the canonical share URL. */
export function CopyLinkCard({ url, display }: Props) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      // Clipboard blocked (insecure context / permissions) — leave the card as-is.
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={copy}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          copy();
        }
      }}
      aria-label="Copy share URL"
      title="Click to copy"
      className="flex cursor-pointer items-stretch rounded-lg border bg-surface py-2 pl-3.5 pr-2 transition-colors hover:bg-surface-2"
      style={{ borderColor: copied ? 'var(--color-accent)' : 'var(--color-hairline)' }}
    >
      <span className="flex items-center border-r border-hairline pr-3 font-mono text-[11px] uppercase tracking-wide text-fg-3">
        URL
      </span>
      <span className="flex flex-1 items-center overflow-hidden text-ellipsis whitespace-nowrap px-3 font-mono text-[13px] text-fg">
        {display}
      </span>
      <span className="flex w-16 flex-shrink-0 items-center justify-center gap-1.5 border-l border-hairline pl-2.5 text-xs font-medium text-fg-3">
        {copied ? (
          'Copied'
        ) : (
          <>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-[13px] w-[13px]">
              <rect x="5" y="5" width="8" height="8" rx="1.5" />
              <path d="M3 11V4a1 1 0 0 1 1-1h7" />
            </svg>
            Copy
          </>
        )}
      </span>
    </div>
  );
}
