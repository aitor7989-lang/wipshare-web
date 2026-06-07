import Link from 'next/link';
import { SiteFrame } from '@/components/SiteFrame';

type Props = {
  title?: string;
  sub?: string;
};

/**
 * The calm "no longer available" state - shared by expired/removed clips and the
 * not-found page. Never the default framework error.
 */
export function Unavailable({
  title = 'This clip is no longer available',
  sub = 'Links expire after a week. This one may have run out, or the owner removed it.',
}: Props) {
  return (
    <SiteFrame>
      <main className="flex flex-1 flex-col items-center px-6">
        <div className="my-[4vh] flex w-[min(94vw,440px)] flex-col items-center text-center">
          <div
            className="flex w-full flex-col items-center gap-1.5 rounded-2xl border border-hairline bg-surface px-[30px] pb-7 pt-[34px]"
            style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 24px 60px rgba(0,0,0,0.4)' }}
          >
            <span className="mb-3.5 inline-flex h-[52px] w-[52px] items-center justify-center rounded-[14px] border border-hairline bg-surface-2 text-fg-3">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden>
                <circle cx="8" cy="8" r="6" />
                <path d="M8 4.5v4M8 8l2.5 1.5" />
              </svg>
            </span>
            <h1 className="text-[19px] font-semibold tracking-[-0.02em] text-fg">{title}</h1>
            <p className="max-w-[34ch] text-sm leading-relaxed text-fg-3">{sub}</p>
            <Link
              href="/"
              className="mt-5 inline-flex h-10 items-center gap-2 rounded-full border border-transparent bg-[#e9eaed] px-[18px] text-sm font-medium text-[#0b0c0d] transition-colors hover:bg-white"
              style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.85), 0 1px 2px rgba(0,0,0,0.4)' }}
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-[15px] w-[15px]" aria-hidden>
                <path d="M2.5 5.5V3.5h2M11.5 3.5h2v2M13.5 10.5v2h-2M4.5 12.5h-2v-2" />
                <rect x="6" y="6" width="4" height="4" rx="0.5" />
              </svg>
              Capture your own clip
            </Link>
          </div>
          <div className="mt-3.5 text-[13px] text-fg-3">
            <Link href="/" className="text-fg-2 hover:text-fg">
              What is WipShare?
            </Link>
          </div>
        </div>
      </main>
    </SiteFrame>
  );
}
