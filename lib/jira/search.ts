/**
 * Issue search. This instance removed the legacy `/rest/api/3/search`
 * (410 Gone), so `POST /search/jql` with a `nextPageToken` cursor is the only
 * way to page through results.
 */

import { jiraRequest } from './client';
import type { JiraApproximateCount, JiraIssue, JiraSearchPage } from './types';

/** The only fields the dashboard renders. Asking for `*all` is wasteful. */
export const ISSUE_FIELDS = [
  'summary',
  'status',
  'priority',
  'duedate',
  'project',
  'issuetype',
  'assignee',
  'updated',
  'parent',
  'labels',
] as const;

const PAGE_SIZE = 100;
/** Guard against a runaway cursor loop on a query that matches everything. */
const MAX_PAGES = 20;

export type SearchIssuesOptions = {
  jql: string;
  fields?: readonly string[];
  /** Stop once this many issues have been collected. */
  limit?: number;
  signal?: AbortSignal;
};

export async function searchIssues({
  jql,
  fields = ISSUE_FIELDS,
  limit,
  signal,
}: SearchIssuesOptions): Promise<JiraIssue[]> {
  const issues: JiraIssue[] = [];
  let nextPageToken: string | undefined;
  let pages = 0;

  do {
    const remaining = limit === undefined ? PAGE_SIZE : Math.min(PAGE_SIZE, limit - issues.length);
    if (remaining <= 0) break;

    const page = await jiraRequest<JiraSearchPage>('/rest/api/3/search/jql', {
      method: 'POST',
      body: {
        jql,
        fields: [...fields],
        maxResults: remaining,
        ...(nextPageToken ? { nextPageToken } : {}),
      },
      signal,
    });

    issues.push(...(page.issues ?? []));
    nextPageToken = page.isLast ? undefined : page.nextPageToken;
    pages += 1;
  } while (nextPageToken && pages < MAX_PAGES && (limit === undefined || issues.length < limit));

  return limit === undefined ? issues : issues.slice(0, limit);
}

/**
 * Cheap count for the header totals. Jira calls it approximate because it reads
 * the index rather than the issues, which is exactly what we want here.
 */
export async function approximateCount(jql: string, signal?: AbortSignal): Promise<number> {
  const result = await jiraRequest<JiraApproximateCount>('/rest/api/3/search/approximate-count', {
    method: 'POST',
    body: { jql },
    signal,
  });
  return result.count;
}
