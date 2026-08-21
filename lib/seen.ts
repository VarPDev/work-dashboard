/**
 * "What is new since I last looked."
 *
 * Each row is remembered by a marker rather than a timestamp: for a mention it
 * is the id of the comment shown, for assigned work the issue's `updated` value.
 * So a row counts as new when it was not there before, *or* when the thing that
 * matters about it has changed — a newer comment, a fresh edit — which is the
 * signal worth a badge.
 *
 * Pure functions; lib/seen-store.ts keeps the state on disk.
 */

import type { DashboardItem } from './dashboard-types';

/** issueKey -> the marker that was on screen when it was last acknowledged. */
export type SeenState = Record<string, string>;

export function markerOf(item: DashboardItem): string {
  return item.mention ? `comment:${item.mention.commentId}` : `updated:${item.issue.updated}`;
}

export function parseSeen(raw: string | null): SeenState {
  if (!raw) return {};

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};

    const state: SeenState = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'string') state[key] = value;
    }
    return state;
  } catch {
    return {};
  }
}

/**
 * Nothing is new on a first run: an empty state means "never acknowledged", and
 * badging the entire list would say nothing.
 */
export function isNew(item: DashboardItem, seen: SeenState): boolean {
  if (Object.keys(seen).length === 0) return false;
  return seen[item.issue.key] !== markerOf(item);
}

export function countNew(items: readonly DashboardItem[], seen: SeenState): number {
  return items.filter((item) => isNew(item, seen)).length;
}

/**
 * The state to store once the current list has been acknowledged. Only what is
 * on screen is kept, so the file cannot grow forever: an issue that leaves the
 * list and comes back later is simply new again.
 */
export function acknowledge(items: readonly DashboardItem[]): SeenState {
  const state: SeenState = {};
  for (const item of items) state[item.issue.key] = markerOf(item);
  return state;
}
