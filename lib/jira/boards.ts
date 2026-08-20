/**
 * Boards, and the issue -> boards mapping the dashboard groups by.
 */

import { RESTRICT_BOARDS_TO_ISSUE_PROJECTS } from '@/config/boards';
import { USERS_CACHE_TTL_MS } from '@/config/app';
import { cached, cacheKeys } from '@/lib/cache';
import { mapWithConcurrency } from '@/lib/concurrency';

import { jiraRequest } from './client';
import { jqlString } from './jql';
import type { JiraAgilePage, JiraBoard } from './types';

/** Parallel board queries. Same ceiling as the comment scan. */
const BOARD_QUERY_CONCURRENCY = 5;
/** Keep the `key in (...)` clause to a sane URL length. */
const MAX_KEYS_PER_QUERY = 300;

/**
 * Every visible board. Cached for an hour like the user list: boards are
 * created and renamed rarely, and this costs one call per hour instead of one
 * per dashboard refresh.
 *
 * The Agile API really does paginate with startAt, unlike issue search.
 */
export async function getBoards(signal?: AbortSignal): Promise<JiraBoard[]> {
  return cached(cacheKeys.boards(), USERS_CACHE_TTL_MS, async () => {
    const boards: JiraBoard[] = [];
    let startAt = 0;

    for (;;) {
      const page = await jiraRequest<JiraAgilePage<JiraBoard>>('/rest/agile/1.0/board', {
        searchParams: { startAt, maxResults: 50 },
        signal,
      });

      boards.push(...page.values);
      if (page.isLast || page.values.length === 0) break;
      startAt += page.values.length;
    }

    return boards;
  });
}

export type BoardMapping = {
  byIssueKey: Map<string, JiraBoard[]>;
  /** How many boards were actually queried, for the call budget log. */
  boardsQueried: number;
  /** Boards that refused the query, so a missing group can be explained. */
  failedBoards: string[];
};

/**
 * Which boards each issue is on.
 *
 * One call per board, filtered down to the issues we care about, rather than one
 * call per issue: 13 calls for 65 issues on this instance.
 */
export async function mapIssuesToBoards(
  issueKeys: readonly string[],
  projectKeys: readonly string[],
  signal?: AbortSignal,
): Promise<BoardMapping> {
  const byIssueKey = new Map<string, JiraBoard[]>();
  if (issueKeys.length === 0) {
    return { byIssueKey, boardsQueried: 0, failedBoards: [] };
  }

  const boards = await getBoards(signal);
  const relevant = RESTRICT_BOARDS_TO_ISSUE_PROJECTS
    ? boards.filter(
        (board) =>
          board.location?.projectKey && projectKeys.includes(board.location.projectKey),
      )
    : boards;

  const keys = issueKeys.slice(0, MAX_KEYS_PER_QUERY);
  if (keys.length < issueKeys.length) {
    console.warn(
      `[boards] grouping only the first ${MAX_KEYS_PER_QUERY} of ${issueKeys.length} issues`,
    );
  }
  const jql = `key in (${keys.map(jqlString).join(', ')})`;
  const failedBoards: string[] = [];

  await mapWithConcurrency(relevant, BOARD_QUERY_CONCURRENCY, async (board) => {
    try {
      const page = await jiraRequest<{ issues: { key: string }[] }>(
        `/rest/agile/1.0/board/${board.id}/issue`,
        {
          searchParams: { jql, fields: 'key', maxResults: 100 },
          signal,
        },
      );

      for (const issue of page.issues ?? []) {
        const current = byIssueKey.get(issue.key);
        if (current) current.push(board);
        else byIssueKey.set(issue.key, [board]);
      }
    } catch {
      // A single unhappy board must not sink the whole dashboard; the issue
      // just lands in the "no board" group and the board is reported.
      failedBoards.push(board.name);
    }
  });

  return { byIssueKey, boardsQueried: relevant.length, failedBoards };
}
