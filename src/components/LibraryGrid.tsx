'use client';

import { useState } from 'react';
import { ClipCard, type ClipCardData } from './ClipCard';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'public', label: 'Public' },
  { key: 'private', label: 'Private' },
] as const;

type FilterKey = (typeof FILTERS)[number]['key'];

/**
 * The library grid with the All / Public / Private segmented filter (me.html
 * toolbar). Filtering is client-side over the already-fetched list and keys off
 * the clip's underlying visibility — a password-protected clip is public, so it
 * shows under "Public" (its card still wears the "Password" badge).
 *
 * The design's search box is out of scope for this brief and intentionally
 * omitted.
 */
export function LibraryGrid({ cards }: { cards: ClipCardData[] }) {
  const [filter, setFilter] = useState<FilterKey>('all');
  const shown = filter === 'all' ? cards : cards.filter((c) => c.visibility === filter);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-3">
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
        <p className="py-16 text-center text-sm text-fg-3">No {filter} clips.</p>
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
