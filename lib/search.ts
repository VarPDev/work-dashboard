/**
 * Fuzzy full-text search over what is already on screen.
 *
 * Client-side on purpose: the payload is a few dozen items, so searching in the
 * browser is instant and costs no Jira call. Fuzzy because the point is to find
 * a ticket you half-remember — a typo, a partial word or the wrong language
 * should still land on it.
 */

import Fuse, { type IFuseOptions } from 'fuse.js';

import type { DashboardItem } from './dashboard-types';

/**
 * What a search looks at, most distinctive first. The weights decide ties: the
 * key and the summary are what people actually remember, a status name is shared
 * by dozens of rows.
 */
const KEYS: { name: string; weight: number; getFn: (item: DashboardItem) => string }[] = [
  { name: 'key', weight: 1, getFn: (item) => item.issue.key },
  { name: 'summary', weight: 0.9, getFn: (item) => item.issue.summary },
  { name: 'mentionText', weight: 0.6, getFn: (item) => item.mention?.text ?? '' },
  { name: 'labels', weight: 0.5, getFn: (item) => item.issue.labels.join(' ') },
  { name: 'project', weight: 0.4, getFn: (item) => item.issue.project.name },
  { name: 'board', weight: 0.4, getFn: (item) => item.board.label },
  { name: 'assignee', weight: 0.4, getFn: (item) => item.issue.assignee?.displayName ?? '' },
  { name: 'mentionedBy', weight: 0.4, getFn: (item) => item.mention?.byDisplayName ?? '' },
  { name: 'parent', weight: 0.3, getFn: (item) => item.issue.parentKey ?? '' },
  { name: 'issueType', weight: 0.2, getFn: (item) => item.issue.issueType },
  { name: 'status', weight: 0.2, getFn: (item) => item.issue.status.name },
];

const OPTIONS: IFuseOptions<DashboardItem> = {
  keys: KEYS,
  includeScore: true,
  // Position-independent: "sorting" should match a summary that mentions it
  // halfway through, not only at the start.
  ignoreLocation: true,
  // 0 is exact, 1 matches anything. 0.38 tolerates a typo or two in a word
  // without turning every query into a list of everything.
  threshold: 0.38,
  minMatchCharLength: 2,
  ignoreDiacritics: true,
};

export const MIN_QUERY_LENGTH = 2;

export function buildSearchIndex(items: readonly DashboardItem[]): Fuse<DashboardItem> {
  return new Fuse([...items], OPTIONS);
}

/** Looks like a Jira key: two or more letters, a dash, digits. */
const ISSUE_KEY = /^[A-Za-z][A-Za-z0-9_]*-\d+$/;

/**
 * Ranked matches, best first.
 *
 * A full issue key is answered exactly, not fuzzily: pasting SDE-10607 should
 * give that one row, and not the dozen keys from the same project that a fuzzy
 * index considers one edit away.
 */
export function searchItems(
  index: Fuse<DashboardItem>,
  items: readonly DashboardItem[],
  query: string,
): DashboardItem[] {
  const trimmed = query.trim();
  if (trimmed.length < MIN_QUERY_LENGTH) return [...items];

  if (ISSUE_KEY.test(trimmed)) {
    const wanted = trimmed.toUpperCase();
    const exact = items.filter((item) => item.issue.key.toUpperCase() === wanted);
    // Only take this path when the key is actually on screen; a key that is not
    // in the list falls through, so a typo in it can still find something.
    if (exact.length > 0) return exact;
  }

  return index
    .search(trimmed)
    .sort((a, b) => (a.score ?? 1) - (b.score ?? 1))
    .map((result) => result.item);
}
