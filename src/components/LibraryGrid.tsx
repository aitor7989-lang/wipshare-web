'use client';

import { useState } from 'react';
import { ClipCard, clipCategory, type ClipCardData } from './ClipCard';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'public', label: 'Public' },
  { key: 'private', label: 'Private' },
  { key: 'password', label: 'Password' },
] as const;

type FilterKey = (typeof FILTERS)[number]['key'];

/**
 * The library grid with a search box + the All / Public / Private / Password
 * segmented filter (me.html toolbar). Both are client-side over the fetched
 * list. The filter keys off the clip's derived category (public / private /
 * password); search matches the title.
 */
export function LibraryGrid({ cards }: { cards: ClipCardData[] }) {
  const [filter, setFilter] = useState<FilterKey>('all');
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const shown = cards.filter((c) => {
    const matchVis = filter === 'all' || clipCategory(c) === filter;
    const matchText = !q || c.title.toLowerCase().includes(q);
    return matchVis && matchText;
  });

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] max-w-[340px] flex-1">
          <span className="pointer-events-none absolute left-[11px] top-1/2 flex -translate-y-1/2 text-fg-3">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden>
              <circle cx="7" cy="7" r="4" />
              <path d="M10 10l3 3" />
            </svg>
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your clips…"
            aria-label="Search your clips"
            className="h-9 w-full rounded-lg border border-hairline bg-surface pl-[34px] pr-3 text-sm text-fg outline-none transition-colors placeholder:text-fg-3 focus:border-accent focus:shadow-[0_0_0_3px_var(--color-accent-dim)]"
          />
        </div>

        <div className="inline-flex" role="group" aria-label="Filter clips by visibility">
          {FILTERS.map((f, i) => {
            const on = filter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                aria-pressed={on}
                onClick={() => setFilter(f.key)}
                className={`relative h-9 border border-hairline px-3 text-[13px] font-medium transition-colors ${
                  i === 0 ? 'rounded-l-lg' : '-ml-px'
                } ${i === FILTERS.length - 1 ? 'rounded-r-lg' : ''} ${
                  on
                    ? 'z-10 border-hairline-strong bg-surface-2 text-fg'
                    : 'bg-surface text-fg-2 hover:bg-surface-2 hover:text-fg'
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="py-16 text-center text-sm text-fg-3">No clips match your search.</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(264px,1fr))] gap-[18px]">
          {shown.map((c) => (
            <ClipCard key={c.id} clip={c} />
          ))}
        </div>
      )}
    </>
  );
}
