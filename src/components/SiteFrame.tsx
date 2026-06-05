import type { ReactNode } from 'react';
import Link from 'next/link';

type Props = {
  /** Right-hand header slot (e.g. "Your clips" link or a "shared with you" tag). */
  headerRight?: ReactNode;
  /** Show the "Made with WipShare" footer (the visitor + unavailable surfaces). */
  footer?: boolean;
  children: ReactNode;
};

/**
 * Shared page chrome for the web surfaces: the top-origin grey wash, the
 * wordmark header (with a right slot), and the optional conversion footer.
 */
export function SiteFrame({ headerRight, footer = false, children }: Props) {
  return (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden">
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{ background: 'radial-gradient(160% 420px at 50% 0%, rgba(255,255,255,0.06), rgba(255,255,255,0) 70%)' }}
        aria-hidden
      />
      <div className="relative z-[2] flex min-h-screen flex-col">
        <header className="flex items-center justify-between border-b border-hairline px-6 py-[18px]">
          <Link
            href="/"
            className="inline-flex items-center gap-[9px] text-base font-medium tracking-tight text-fg"
            aria-label="WipShare home"
          >
            <span className="relative inline-block h-[22px] w-[22px] rounded-md bg-accent">
              <span className="absolute right-[5px] top-[5px] h-[7px] w-[7px] rounded-full bg-bg" />
            </span>
            <span>wipshare</span>
          </Link>
          {headerRight ?? null}
        </header>

        {children}

        {footer ? (
          <footer className="flex items-center justify-center border-t border-hairline px-6 py-[18px] text-xs text-fg-3">
            <span className="inline-flex items-center gap-2 font-mono tracking-[0.02em]">
              <span className="relative h-3 w-3 rounded-[3px] bg-accent">
                <span className="absolute right-[3px] top-[3px] h-1 w-1 rounded-full bg-bg" />
              </span>
              Made with{' '}
              <Link href="/" className="text-fg-2 hover:text-fg">
                WipShare
              </Link>
            </span>
          </footer>
        ) : null}
      </div>
    </div>
  );
}
