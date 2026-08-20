/**
 * Turning Jira's priority list into a rank. Pure, so the ranking rule is
 * testable without touching the API.
 */

import { PRIORITY_ORDER } from '@/config/priority';
import type { JiraIssue, JiraPriority } from '@/lib/jira/types';

/** Lower rank means more urgent. */
export type PriorityRanks = {
  byId: Map<string, number>;
  byName: Map<string, number>;
};

/** An issue with no priority at all sorts below every ranked one. */
export const UNRANKED = Number.MAX_SAFE_INTEGER;

/**
 * Rank = position in config/priority.ts, and for anything not listed there, its
 * position in the order Jira returned, pushed after all the configured ones.
 */
export function buildPriorityRanks(priorities: readonly JiraPriority[]): PriorityRanks {
  const byId = new Map<string, number>();
  const byName = new Map<string, number>();

  priorities.forEach((priority, jiraIndex) => {
    const configured = PRIORITY_ORDER.indexOf(priority.name);
    const rank = configured === -1 ? PRIORITY_ORDER.length + jiraIndex : configured;
    byId.set(priority.id, rank);
    byName.set(priority.name, rank);
  });

  return { byId, byName };
}

export function priorityRank(issue: JiraIssue, ranks: PriorityRanks): number {
  const priority = issue.fields.priority;
  if (!priority) return UNRANKED;
  return ranks.byId.get(priority.id) ?? ranks.byName.get(priority.name) ?? UNRANKED;
}
