'use client';

import { useEffect, useRef, useState } from 'react';

type Props = {
  clipId: string;
  initialTitle: string;
};

/**
 * Owner-only inline rename. Click (or Enter/Space) to edit; Enter commits a
 * PATCH, Esc cancels, empty reverts. The change is optimistic and rolls back if
 * the server rejects it (e.g. the cookie no longer matches → 403).
 */
export function ClipTitleEditable({ clipId, initialTitle }: Props) {
  const [title, setTitle] = useState(initialTitle);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialTitle);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const startEdit = () => {
    setDraft(title);
    setEditing(true);
  };

  const commit = () => {
    if (!editing) return;
    setEditing(false);
    const v = draft.replace(/\s+/g, ' ').trim();
    if (v.length === 0 || v === title) return;

    const prev = title;
    setTitle(v); // optimistic
    void fetch(`/api/clips/${clipId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: v }),
    })
      .then(async (res) => {
        if (!res.ok) {
          setTitle(prev);
          return;
        }
        const json = (await res.json().catch(() => null)) as { data?: { title?: string } } | null;
        if (typeof json?.data?.title === 'string') setTitle(json.data.title);
      })
      .catch(() => setTitle(prev));
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            setDraft(title);
            setEditing(false);
          }
        }}
        aria-label="Clip title"
        maxLength={200}
        className="-ml-1.5 w-full rounded-md border border-accent bg-surface px-1.5 py-0.5 text-[22px] font-medium leading-tight tracking-[-0.02em] text-fg outline-none"
        style={{ boxShadow: '0 0 0 3px var(--color-accent-dim)' }}
      />
    );
  }

  return (
    <div className="group inline-flex max-w-full items-center gap-2">
      <h1
        role="button"
        tabIndex={0}
        title="Click to rename"
        onClick={startEdit}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            startEdit();
          }
        }}
        className="-ml-1.5 cursor-text overflow-hidden text-ellipsis whitespace-nowrap rounded-md border border-transparent px-1.5 py-0.5 text-[22px] font-medium leading-tight tracking-[-0.02em] text-fg hover:border-hairline hover:bg-surface"
      >
        {title}
      </h1>
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 flex-shrink-0 text-fg-3 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden>
        <path d="M11 2.5l2.5 2.5L6 12.5 3 13l.5-3z" />
      </svg>
    </div>
  );
}
