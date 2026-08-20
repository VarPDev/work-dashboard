/**
 * Display formatting. Browser-safe: no server imports.
 *
 * Everything takes a BCP 47 tag and goes through Intl, so dates and relative
 * times read naturally in whatever locale is active instead of being written out
 * in one language.
 */

/** "05 ago" / "05 Aug" from a Jira duedate ("2026-08-05"), read as a plain date. */
export function formatDueDate(duedate: string, tag: string): string {
  const [year, month, day] = duedate.split('-').map(Number);
  return new Intl.DateTimeFormat(tag, { day: '2-digit', month: 'short' }).format(
    new Date(year, month - 1, day),
  );
}

export function formatClockTime(iso: string, tag: string): string {
  return new Intl.DateTimeFormat(tag, { hour: '2-digit', minute: '2-digit' }).format(
    new Date(iso),
  );
}

function relative(tag: string): Intl.RelativeTimeFormat {
  return new Intl.RelativeTimeFormat(tag, { numeric: 'auto' });
}

/** How long ago a mention was written: "ieri", "3 giorni fa", "2 mesi fa". */
export function formatRelative(iso: string, tag: string, now: Date = new Date()): string {
  const days = Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000);
  if (days < 30) return relative(tag).format(-Math.max(days, 0), 'day');
  return relative(tag).format(-Math.floor(days / 30), 'month');
}

/**
 * How old the data on screen is. Worth saying out loud: the payload is cached for
 * half an hour, so the time it was taken alone hides how stale it may be.
 *
 * `justNow` comes from the messages, because Intl renders zero minutes as
 * something clumsy ("in questo momento").
 */
export function formatAge(iso: string, tag: string, justNow: string, now: Date = new Date()): string {
  const minutes = Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return justNow;
  if (minutes < 60) return relative(tag).format(-minutes, 'minute');
  return relative(tag).format(-Math.floor(minutes / 60), 'hour');
}

/** Initials for an avatar fallback. */
export function initials(displayName: string): string {
  return displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}
