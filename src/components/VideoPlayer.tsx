'use client';

import { type KeyboardEvent as ReactKeyboardEvent, useCallback, useEffect, useRef, useState } from 'react';

type Props = {
  src: string;
  poster?: string | undefined;
  width?: number | undefined;
  height?: number | undefined;
};

function fmt(s: number): string {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

/* Cross-browser fullscreen — Safari/iOS still need the webkit-prefixed API and
 * event. We fullscreen the styled WRAPPER (not the bare <video>) so the custom
 * control bar comes along; the `:fullscreen` CSS in globals.css resizes it. */
type FullscreenDoc = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => void;
};
type FullscreenEl = HTMLElement & {
  webkitRequestFullscreen?: () => void;
};
function currentFullscreenElement(): Element | null {
  return document.fullscreenElement ?? (document as FullscreenDoc).webkitFullscreenElement ?? null;
}
function requestFullscreenOn(el: HTMLElement): void {
  const e = el as FullscreenEl;
  if (e.requestFullscreen) void e.requestFullscreen();
  else if (e.webkitRequestFullscreen) e.webkitRequestFullscreen();
}
function exitFullscreenNow(): void {
  const d = document as FullscreenDoc;
  if (document.exitFullscreen) void document.exitFullscreen();
  else if (d.webkitExitFullscreen) d.webkitExitFullscreen();
}

/**
 * Styled player over a native <video>, driven via the media element API.
 * Keyboard: Space (play/pause), ←/→ (seek ∓2s), M (mute), L (loop), F (fullscreen).
 * The scrubber shows played + buffered ranges. The box is reserved at the clip's
 * real aspect ratio (no layout shift, no 16:9 letterboxing); a calm placeholder
 * shows until loadedmetadata.
 */
export function VideoPlayer({ src, poster, width, height }: Props) {
  const aspect = width && height && width > 0 && height > 0 ? `${width} / ${height}` : undefined;
  const videoRef = useRef<HTMLVideoElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const scrubberRef = useRef<HTMLDivElement>(null);
  const playedRef = useRef<HTMLDivElement>(null);

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedFrac, setBufferedFrac] = useState(0);
  const [ready, setReady] = useState(false);
  const [loop, setLoop] = useState(true); // loop on by default (matches design)
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const onTime = () => {
      setCurrent(v.currentTime);
      if (v.buffered.length > 0 && v.duration > 0) {
        setBufferedFrac(Math.min(1, v.buffered.end(v.buffered.length - 1) / v.duration));
      }
    };
    const onMeta = () => {
      setDuration(v.duration);
      setReady(true);
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onVolume = () => setMuted(v.muted);

    // Auto-play once the clip is buffered enough to play through. Browsers block
    // autoplay *with sound* without a prior user gesture, so attempt sound first
    // and fall back to muted (always permitted) — the user can unmute. Runs once.
    let autoplayed = false;
    const tryAutoplay = () => {
      if (autoplayed) return;
      autoplayed = true;
      void v.play().catch(() => {
        v.muted = true;
        void v.play().catch(() => {
          // Still blocked — leave it paused; the Play button works.
        });
      });
    };

    v.addEventListener('timeupdate', onTime);
    v.addEventListener('progress', onTime);
    v.addEventListener('loadedmetadata', onMeta);
    v.addEventListener('durationchange', onMeta);
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    v.addEventListener('volumechange', onVolume);
    v.addEventListener('canplay', tryAutoplay);
    v.addEventListener('canplaythrough', tryAutoplay);

    // If the clip was already buffered before this effect attached (cache/fast
    // network), the canplay event may have fired already — kick it off directly.
    if (v.readyState >= 3) tryAutoplay();

    return () => {
      v.removeEventListener('timeupdate', onTime);
      v.removeEventListener('progress', onTime);
      v.removeEventListener('loadedmetadata', onMeta);
      v.removeEventListener('durationchange', onMeta);
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
      v.removeEventListener('volumechange', onVolume);
      v.removeEventListener('canplay', tryAutoplay);
      v.removeEventListener('canplaythrough', tryAutoplay);
    };
  }, []);

  // Keep the fullscreen button + styling in sync even when the user leaves
  // fullscreen via Esc or the browser chrome (not just our button). Covers the
  // webkit-prefixed event for Safari.
  useEffect(() => {
    const sync = () => setIsFullscreen(currentFullscreenElement() === cardRef.current);
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync);
    };
  }, []);

  // Drive the played bar from requestAnimationFrame (reading currentTime each
  // frame) rather than the ~4 Hz `timeupdate` event, so it advances smoothly at
  // the display refresh rate instead of stepping every ~0.25-0.5s. Writes one
  // style prop per frame; no React re-render.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const v = videoRef.current;
      const el = playedRef.current;
      if (v && el) {
        const d = v.duration;
        const frac = Number.isFinite(d) && d > 0 ? Math.min(1, v.currentTime / d) : 0;
        el.style.width = `${(frac * 100).toFixed(3)}%`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play();
    else v.pause();
  }, []);

  const seekBy = useCallback((delta: number) => {
    const v = videoRef.current;
    if (!v) return;
    const d = Number.isFinite(v.duration) ? v.duration : 0;
    v.currentTime = Math.max(0, Math.min(d || v.currentTime + delta, v.currentTime + delta));
  }, []);

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = cardRef.current;
    if (!el) return;
    if (currentFullscreenElement()) exitFullscreenNow();
    else requestFullscreenOn(el);
  }, []);

  const toggleLoop = useCallback(() => setLoop((prev) => !prev), []);

  const seekToClient = useCallback((clientX: number) => {
    const v = videoRef.current;
    const bar = scrubberRef.current;
    if (!v || !bar || !Number.isFinite(v.duration) || v.duration <= 0) return;
    const rect = bar.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    v.currentTime = frac * v.duration;
  }, []);

  const onKeyDown = useCallback(
    (e: ReactKeyboardEvent) => {
      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          seekBy(-2);
          break;
        case 'ArrowRight':
          e.preventDefault();
          seekBy(2);
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          toggleMute();
          break;
        case 'l':
        case 'L':
          e.preventDefault();
          toggleLoop();
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          toggleFullscreen();
          break;
        default:
          break;
      }
    },
    [togglePlay, seekBy, toggleMute, toggleLoop, toggleFullscreen],
  );

  return (
    <section
      ref={cardRef}
      className="wip-player relative rounded-xl border border-hairline bg-surface p-3 outline-none"
      aria-label="Clip player"
      tabIndex={0}
      onKeyDown={onKeyDown}
    >
      <div
        className={`wip-stage relative w-full overflow-hidden rounded-[7px] border border-hairline bg-black${aspect ? '' : ' aspect-video'}`}
        style={aspect ? { aspectRatio: aspect, maxHeight: '80vh' } : undefined}
      >
        <video
          ref={videoRef}
          className="block h-full w-full object-contain"
          preload="auto"
          playsInline
          loop={loop}
          poster={poster}
          onClick={togglePlay}
        >
          <source src={src} type="video/mp4" />
          Your browser does not support the video tag.
        </video>

        {!ready && (
          <div
            className="pointer-events-none absolute inset-0 flex items-center justify-center font-mono text-xs uppercase tracking-wider text-fg-3"
            style={{
              background:
                'linear-gradient(135deg, rgba(255,255,255,0.02), rgba(255,255,255,0)), repeating-linear-gradient(45deg, rgba(255,255,255,0.018) 0 12px, rgba(255,255,255,0) 12px 24px), #0a0b0c',
            }}
          >
            loading clip…
          </div>
        )}
      </div>

      {/* control strip */}
      <div className="flex items-center gap-3 px-1 pb-0.5 pt-2.5 text-fg-2">
        <button
          type="button"
          onClick={togglePlay}
          aria-label={playing ? 'Pause' : 'Play'}
          title={playing ? 'Pause · Space' : 'Play · Space'}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-hairline bg-surface-2 text-fg hover:border-hairline-strong"
        >
          {playing ? (
            <svg viewBox="0 0 16 16" fill="currentColor" className="h-2.5 w-2.5">
              <rect x="3" y="2" width="4" height="12" rx="1" />
              <rect x="9" y="2" width="4" height="12" rx="1" />
            </svg>
          ) : (
            <svg viewBox="0 0 10 12" fill="currentColor" className="h-2.5 w-2.5">
              <path d="M0 0v12l10-6z" />
            </svg>
          )}
        </button>

        <button
          type="button"
          onClick={() => seekBy(-2)}
          aria-label="Back 2 seconds"
          title="Back 2s · ←"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-fg hover:bg-surface-2"
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-[15px] w-[15px]">
            <path d="M7 3 3 6.5 7 10" />
            <path d="M3 6.5h6.5A3.5 3.5 0 0 1 13 10a3.5 3.5 0 0 1-3.5 3.5H6" />
          </svg>
        </button>

        <button
          type="button"
          onClick={() => seekBy(2)}
          aria-label="Forward 2 seconds"
          title="Forward 2s · →"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-fg hover:bg-surface-2"
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-[15px] w-[15px]">
            <path d="M9 3l4 3.5L9 10" />
            <path d="M13 6.5H6.5A3.5 3.5 0 0 0 3 10a3.5 3.5 0 0 0 3.5 3.5H10" />
          </svg>
        </button>

        <div
          ref={scrubberRef}
          className="relative h-[3px] flex-1 cursor-pointer overflow-hidden rounded-full"
          style={{ background: 'rgba(255,255,255,0.08)' }}
          onClick={(e) => seekToClient(e.clientX)}
          role="slider"
          aria-label="Seek"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(current)}
        >
          <div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{ width: `${bufferedFrac * 100}%`, background: 'rgba(255,255,255,0.10)' }}
          />
          <div
            ref={playedRef}
            className="absolute inset-y-0 left-0 rounded-full bg-accent"
            style={{ width: 0 }}
          />
        </div>

        <div className="min-w-[88px] text-right font-mono text-xs tabular-nums text-fg-2">
          {fmt(current)} / {fmt(duration)}
        </div>

        <div className="flex items-center gap-1.5 text-fg">
          <button
            type="button"
            onClick={toggleLoop}
            aria-label="Loop"
            aria-pressed={loop}
            title="Loop · L"
            className={`inline-flex h-7 w-7 items-center justify-center rounded-md ${loop ? 'bg-accent-dim text-accent-hi hover:bg-[rgba(94,106,210,0.22)]' : 'hover:bg-surface-2'}`}
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
              <path d="M4 5h6a3 3 0 0 1 3 3a3 3 0 0 1-.5 1.7" />
              <path d="M12 11H6a3 3 0 0 1-3-3a3 3 0 0 1 .5-1.7" />
              <path d="M4 3 2.5 5 4 7" />
              <path d="M12 13l1.5-2L12 9" />
            </svg>
          </button>
          <button
            type="button"
            onClick={toggleMute}
            aria-label={muted ? 'Unmute' : 'Mute'}
            title={muted ? 'Unmute · M' : 'Mute · M'}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-surface-2"
          >
            {muted ? (
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                <path d="M3 6h2l3-2v8L5 10H3z" />
                <path d="M11 6l3 4M14 6l-3 4" />
              </svg>
            ) : (
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                <path d="M3 6h2l3-2v8L5 10H3z" />
                <path d="M11 6c1 1 1 3 0 4" />
                <path d="M13 4c2 2 2 6 0 8" />
              </svg>
            )}
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            aria-pressed={isFullscreen}
            title={isFullscreen ? 'Exit fullscreen · F' : 'Fullscreen · F'}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-surface-2"
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
              <path d="M3 6V3h3" />
              <path d="M13 6V3h-3" />
              <path d="M3 10v3h3" />
              <path d="M13 10v3h-3" />
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
}
