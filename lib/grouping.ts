/**
 * Attaching a board to each issue, and the facets the board filter is built
 * from. Pure functions — the Jira calls happen in lib/jira/boards.ts.
 */

import { BOARD_PRIORITY } from '@/config/boards';
import type { ItemBoard, BoardFacet } from '@/lib/dashboard-types';
import type { JiraBoard, JiraIssue } from '@/lib/jira/types';

/** Anything that carries an issue. */
export type HasIssue = { issue: JiraIssue };

/**
 * Pick one board for an issue that sits on several. Deterministic by design:
 *
 *  1. the order in config/boards.ts
 *  2. a board belonging to the issue's own project, over a cross-project one
 *  3. lowest board id, so the answer never changes between refreshes
 */
export function pickBoard(
  boards: readonly JiraBoard[],
  issue: JiraIssue,
  priority: readonly string[] = BOARD_PRIORITY,
): JiraBoard | null {
  if (boards.length === 0) return null;
  if (boards.length === 1) return boards[0];

  const rank = (board: JiraBoard): number => {
    const index = priority.indexOf(board.name);
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
  };
  const ownProject = (board: JiraBoard): number =>
    board.location?.projectKey === issue.fields.project.key ? 0 : 1;

  return [...boards].sort(
    (a, b) => rank(a) - rank(b) || ownProject(a) - ownProject(b) || a.id - b.id,
  )[0];
}

/**
 * The board an issue is shown under. Issues on no board fall back to their
 * project: the label carries the project name and `kind` says it is not a board,
 * so the UI can word it in whatever language is active.
 */
export function boardOf(
  issue: JiraIssue,
  boardsByIssueKey: ReadonlyMap<string, JiraBoard[]>,
  priority: readonly string[] = BOARD_PRIORITY,
): ItemBoard {
  const board = pickBoard(boardsByIssueKey.get(issue.key) ?? [], issue, priority);
  if (board) return { id: `board:${board.id}`, label: board.name, kind: 'board' };

  const project = issue.fields.project;
  return { id: `project:${project.key}`, label: project.name, kind: 'project' };
}

/**
 * The board filter's options, with the counts shown on each chip. Ordered the
 * way the board sections used to be: most overdue work first, then by name.
 */
export function boardFacets(
  items: readonly { board: ItemBoard; overdue: boolean }[],
): BoardFacet[] {
  const facets = new Map<string, BoardFacet>();

  for (const item of items) {
    const existing = facets.get(item.board.id);
    if (existing) {
      existing.count += 1;
      if (item.overdue) existing.overdueCount += 1;
    } else {
      facets.set(item.board.id, {
        ...item.board,
        count: 1,
        overdueCount: item.overdue ? 1 : 0,
      });
    }
  }

  return [...facets.values()].sort(
    (a, b) => b.overdueCount - a.overdueCount || a.label.localeCompare(b.label),
  );
}

/** The distinct project keys in an issue set, to narrow the board query. */
export function projectKeysOf(items: readonly HasIssue[]): string[] {
  return [...new Set(items.map((item) => item.issue.fields.project.key))];
}

/** The distinct issue keys in an item set. */
export function issueKeysOf(items: readonly HasIssue[]): string[] {
  return [...new Set(items.map((item) => item.issue.key))];
}
