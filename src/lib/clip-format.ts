/** Shared, pure formatting helpers for clip display + download naming. */

/** Date-derived fallback label for a clip with no stored title. */
export function defaultClipTitle(createdAt: Date): string {
  const y = createdAt.getFullYear();
  const m = (createdAt.getMonth() + 1).toString().padStart(2, '0');
  const d = createdAt.getDate().toString().padStart(2, '0');
  return `wipshare-${y}-${m}-${d}`;
}

/** The clip's display title: its stored title, or the date-derived fallback. */
export function clipDisplayTitle(title: string | null, createdAt: Date): string {
  const t = title?.trim();
  return t && t.length > 0 ? t : defaultClipTitle(createdAt);
}

const RESERVED_FILENAME_CHARS = '<>:"/\\|?*';

/** Sanitizes a title into a safe ASCII download-filename base (no extension). */
export function safeFilenameBase(name: string): string {
  let out = '';
  for (const ch of name) {
    const code = ch.codePointAt(0) ?? 0;
    // collapse control chars + filename-reserved chars to a space
    out += code < 0x20 || RESERVED_FILENAME_CHARS.includes(ch) ? ' ' : ch;
  }
  out = out.replace(/\s+/g, ' ').trim().slice(0, 120);
  return out.length > 0 ? out : 'clip';
}

export function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

/** Coarse "N minutes/hours/days ago" (no per-second churn). */
export function formatRelative(date: Date): string {
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 2) return 'yesterday';
  return `${days} days ago`;
}

/** Coarse expiry label (days; switches to hours + amber under 24h). */
export function expiryInfo(expiresAt: Date | null): { label: string; soon: boolean } | null {
  if (!expiresAt) return null;
  const ms = expiresAt.getTime() - Date.now();
  if (ms <= 0) return { label: 'expired', soon: true };
  const dayMs = 86_400_000;
  if (ms < dayMs) {
    const hours = Math.max(1, Math.ceil(ms / 3_600_000));
    return { label: `expires in ${hours} hour${hours === 1 ? '' : 's'}`, soon: true };
  }
  const days = Math.ceil(ms / dayMs);
  return { label: `expires in ${days} day${days === 1 ? '' : 's'}`, soon: false };
}
