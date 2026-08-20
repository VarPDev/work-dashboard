/**
 * Ordering. All pure, and all date handling is done on the "YYYY-MM-DD" strings
 * Jira returns for `duedate` — parsing them into Date objects would drag a
 * timezone into a question that has none ("is this due today?").
 */

import type { HasIssue } from './grouping';
import type { JiraIssue } from './jira/types';
import { priorityRank, type PriorityRanks } from './priority';

/** Today as YYYY-MM-DD in the machine's own timezone. */
export function today(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Add days to a YYYY-MM-DD string, staying in date space. */
export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return shifted.toISOString().slice(0, 10);
}

export function isOverdue(issue: JiraIssue, todayDate: string): boolean {
  const due = issue.fields.duedate;
  return due !== null && due < todayDate;
}

/** Due today, or within the next `days` days. Not overdue. */
export function isDueSoon(issue: JiraIssue, todayDate: string, days = 2): boolean {
  const due = issue.fields.duedate;
  if (due === null || due < todayDate) return false;
  return due <= addDays(todayDate, days);
}

/**
 * Inside a group: priority first, then due date ascending with missing dates
 * last, then most recently updated first.
 */
export function compareIssues(a: JiraIssue, b: JiraIssue, ranks: PriorityRanks): number {
  const byPriority = priorityRank(a, ranks) - priorityRank(b, ranks);
  if (byPriority !== 0) return byPriority;

  const dueA = a.fields.duedate;
  const dueB = b.fields.duedate;
  if (dueA !== dueB) {
    // No due date is not "far away", it is unknown — so it goes to the bottom
    // rather than sorting as an empty string.
    if (dueA === null) return 1;
    if (dueB === null) return -1;
    return dueA < dueB ? -1 : 1;
  }

  // Both dates equal: freshest activity first.
  return b.fields.updated.localeCompare(a.fields.updated);
}

export function sortItems<T extends HasIssue>(items: readonly T[], ranks: PriorityRanks): T[] {
  return [...items].sort((a, b) => compareIssues(a.issue, b.issue, ranks));
}

