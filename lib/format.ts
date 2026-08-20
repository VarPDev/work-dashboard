/**
 * Display formatting. Browser-safe: no server imports.
 */

const DAY_MONTH = new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: 'short' });
const TIME = new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' });

/** "05 ago" from a Jira duedate ("2026-08-05"). Parsed as a plain date. */
export function formatDueDate(duedate: string): string {
  const [year, month, day] = duedate.split('-').map(Number);
  return DAY_MONTH.format(new Date(year, month - 1, day));
}

export function formatClockTime(iso: string): string {
  return TIME.format(new Date(iso));
}

/** "3 giorni fa" for a mention timestamp. */
export function formatRelative(iso: string, now: Date = new Date()): string {
  const days = Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'oggi';
  if (days === 1) return 'ieri';
  if (days < 30) return `${days} giorni fa`;
  const months = Math.floor(days / 30);
  return months === 1 ? '1 mese fa' : `${months} mesi fa`;
}

/**
 * How old the data on screen is. Worth saying out loud: the payload is cached
 * for half an hour, so "aggiornato 15:03" alone hides how stale it may be.
 */
export function formatAge(iso: string, now: Date = new Date()): string {
  const minutes = Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return 'adesso';
  if (minutes < 60) return `${minutes} min fa`;
  const hours = Math.floor(minutes / 60);
  return hours === 1 ? '1 ora fa' : `${hours} ore fa`;
}

/** "1 menzione" / "3 menzioni". */
export function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** Initials for an avatar fallback. */
export function initials(displayName: string): string {
  return displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}
