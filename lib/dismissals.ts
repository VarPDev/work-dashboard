/**
 * "I have decided this one does not need an answer."
 *
 * Dismissals hide a mention until something new happens on it. The watermark is
 * the id of the comment that was dismissed: when a newer comment mentions the
 * user, the mention shown carries a different comment id, the dismissal stops
 * matching, and the row comes back on its own.
 *
 * The state itself is persisted server-side in a JSON file — see
 * lib/dismissals-store.ts. These functions are the pure rules on top of it, so
 * both the API route and the UI can share them.
 */

import type { DashboardItem } from './dashboard-types';

/** issueKey -> dismissed comment id. */
export type Dismissals = Record<string, string>;

/** Keep the store from growing forever on a machine that is never cleaned. */
const MAX_ENTRIES = 500;

export function parseDismissals(raw: string | null): Dismissals {
  if (!raw) return {};

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};

    const result: Dismissals = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'string') result[key] = value;
    }
    return result;
  } catch {
    // Corrupt or hand-edited storage is not worth an error state.
    return {};
  }
}

/** Only mentions can be dismissed: assigned work is not a notification. */
export function isDismissable(item: DashboardItem): boolean {
  return item.kind === 'mention' && item.mention !== null;
}

export function isDismissed(item: DashboardItem, dismissals: Dismissals): boolean {
  if (!isDismissable(item)) return false;
  return dismissals[item.issue.key] === item.mention?.commentId;
}

export function dismiss(item: DashboardItem, dismissals: Dismissals): Dismissals {
  if (!isDismissable(item) || !item.mention) return dismissals;

  const entries = Object.entries({ ...dismissals, [item.issue.key]: item.mention.commentId });
  // Oldest entries go first when the cap is hit; insertion order is good enough
  // for something this size.
  return Object.fromEntries(entries.slice(-MAX_ENTRIES));
}

export function restore(issueKey: string, dismissals: Dismissals): Dismissals {
  if (!(issueKey in dismissals)) return dismissals;
  const next = { ...dismissals };
  delete next[issueKey];
  return next;
}

/**
 * Drop entries whose issue is on screen with a *newer* mention: that dismissal
 * has already expired, so keeping it around only grows the store.
 *
 * Entries for issues that are simply absent are kept — an issue can fall out of
 * the 30-day window and come back with nothing new said on it.
 */
export function pruneDismissals(items: readonly DashboardItem[], dismissals: Dismissals): Dismissals {
  const currentByKey = new Map(
    items.filter(isDismissable).map((item) => [item.issue.key, item.mention?.commentId]),
  );

  const next: Dismissals = {};
  for (const [issueKey, commentId] of Object.entries(dismissals)) {
    if (currentByKey.has(issueKey) && currentByKey.get(issueKey) !== commentId) continue;
    next[issueKey] = commentId;
  }
  return next;
}
