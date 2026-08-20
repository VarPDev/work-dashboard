/**
 * The whole dashboard payload: both sources merged into one sorted list, each
 * item carrying its board, trimmed for the browser. The UI renders this and does
 * no business logic of its own.
 */

import { TASKS_CACHE_TTL_MS } from '@/config/app';
import { cached, cacheKeys, cachedAt, invalidate } from '@/lib/cache';
import type {
  DashboardIssue,
  DashboardItem,
  DashboardPayload,
  ItemBoard,
  SelectableUser,
  TaskKind,
} from '@/lib/dashboard-types';
import { boardOf, issueKeysOf, projectKeysOf } from '@/lib/grouping';
import { withJiraCallCounter } from '@/lib/jira/client';
import { getBoards, mapIssuesToBoards } from '@/lib/jira/boards';
import { getJiraConfig } from '@/lib/jira/env';
import { getAssignedIssues } from '@/lib/jira/issues';
import { getPriorityRanks } from '@/lib/jira/priorities';
import type { JiraIssue } from '@/lib/jira/types';
import { getUnansweredMentions, type UnansweredMention } from '@/lib/jira/unanswered';
import { isDueSoon, isOverdue, sortItems, today } from '@/lib/sorting';

/** Server-side item, still carrying the full Jira issue for grouping/sorting. */
type InternalItem = {
  kind: TaskKind;
  issue: JiraIssue;
  mention?: UnansweredMention;
};

function toDashboardIssue(issue: JiraIssue, baseUrl: string): DashboardIssue {
  return {
    key: issue.key,
    url: `${baseUrl}/browse/${issue.key}`,
    summary: issue.fields.summary,
    status: {
      name: issue.fields.status.name,
      category: issue.fields.status.statusCategory.key,
    },
    priority: issue.fields.priority
      ? { id: issue.fields.priority.id, name: issue.fields.priority.name }
      : null,
    duedate: issue.fields.duedate,
    project: { key: issue.fields.project.key, name: issue.fields.project.name },
    issueType: issue.fields.issuetype.name,
    assignee: issue.fields.assignee
      ? {
          displayName: issue.fields.assignee.displayName,
          avatarUrl: issue.fields.assignee.avatarUrls?.['48x48'] ?? null,
        }
      : null,
    updated: issue.fields.updated,
    labels: issue.fields.labels,
    parentKey: issue.fields.parent?.key ?? null,
  };
}

function toDashboardItem(
  item: InternalItem,
  baseUrl: string,
  todayDate: string,
  board: ItemBoard,
): DashboardItem {
  return {
    kind: item.kind,
    issue: toDashboardIssue(item.issue, baseUrl),
    board,
    mention: item.mention
      ? {
          commentId: item.mention.commentId,
          byDisplayName: item.mention.mentionedBy.displayName,
          byAvatarUrl: item.mention.mentionedBy.avatarUrls?.['48x48'] ?? null,
          text: item.mention.mentionText,
          at: item.mention.mentionedAt,
          commentUrl: item.mention.commentUrl,
        }
      : null,
    overdue: isOverdue(item.issue, todayDate),
    dueSoon: isDueSoon(item.issue, todayDate),
  };
}

async function loadDashboard(user: SelectableUser): Promise<DashboardPayload> {
  const { baseUrl, defaultAccountId } = getJiraConfig();
  const todayDate = today();

  const { result, calls } = await withJiraCallCounter(async () => {
    // Independent, so they overlap: the mention scan is by far the slowest part.
    const [assigned, unanswered, ranks, boards] = await Promise.all([
      getAssignedIssues(user.accountId),
      getUnansweredMentions(user.accountId),
      getPriorityRanks(),
      getBoards(),
    ]);

    const items: InternalItem[] = [
      ...assigned.map((issue) => ({ kind: 'assigned' as const, issue })),
      ...unanswered.mentions.map((mention) => ({
        kind: 'mention' as const,
        issue: mention.issue,
        mention,
      })),
    ];

    const mapping = await mapIssuesToBoards(issueKeysOf(items), projectKeysOf(items));

    // One flat list: the board is a column and a filter, not a section.
    const sorted = sortItems(items, ranks);

    return { sorted, mapping, unanswered, boardsTotal: boards.length };
  });

  const items: DashboardItem[] = result.sorted.map((item) =>
    toDashboardItem(item, baseUrl, todayDate, boardOf(item.issue, result.mapping.byIssueKey)),
  );

  return {
    user,
    isDefaultUser: user.accountId === defaultAccountId,
    generatedAt: new Date().toISOString(),
    totals: {
      assigned: items.filter((item) => item.kind === 'assigned').length,
      mentions: items.filter((item) => item.kind === 'mention').length,
      overdue: items.filter((item) => item.overdue).length,
    },
    items,
    diagnostics: {
      jiraCalls: calls,
      mentionCandidates: result.unanswered.candidateCount,
      mentionsAlreadyAnswered: result.unanswered.answeredCount,
      mentionsInformationalOnly: result.unanswered.informationalOnlyCount,
      mentionFalsePositives: result.unanswered.falsePositiveCount,
      truncatedThreads: result.unanswered.truncatedThreads,
      boardsQueried: result.mapping.boardsQueried,
      boardsTotal: result.boardsTotal,
      failedBoards: result.mapping.failedBoards,
    },
  };
}

/**
 * Refresh means "tell me the truth now", so it drops the board and priority
 * lists as well as this user's tasks. Those two have a one-hour TTL, and without
 * this a board created since the last load would stay invisible for up to an
 * hour — with every issue on it reading as "Senza board" in the meantime.
 */
export function invalidateForRefresh(accountId: string): void {
  invalidate(cacheKeys.tasks(accountId));
  invalidate(cacheKeys.boards());
  invalidate(cacheKeys.priorities());
}

/**
 * The cache key carries the accountId. Getting this wrong would show one
 * person's tasks under another person's name, which is the worst thing this app
 * could do — see lib/cache.test.ts.
 */
export async function getDashboard(
  user: SelectableUser,
  options: { refresh?: boolean } = {},
): Promise<{ payload: DashboardPayload; fromCache: boolean }> {
  const key = cacheKeys.tasks(user.accountId);

  if (options.refresh) invalidateForRefresh(user.accountId);

  const wasCached = cachedAt(key, TASKS_CACHE_TTL_MS) !== null;
  const payload = await cached(key, TASKS_CACHE_TTL_MS, () => loadDashboard(user));

  return { payload, fromCache: wasCached };
}
