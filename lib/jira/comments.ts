/**
 * Comment fetching. This endpoint still paginates the old way
 * (startAt/maxResults), unlike issue search.
 */

import { jiraRequest } from './client';
import type { JiraComment, JiraCommentPage } from './types';

const PAGE_SIZE = 100;

export type CommentPageResult = {
  comments: JiraComment[];
  total: number;
  /** True when the thread is longer than what was fetched. */
  truncated: boolean;
};

/**
 * Newest comments first, at most `maxPages` pages.
 *
 * Descending order is what makes the mention scan cheap: the last mention and
 * everything said after it both live at the recent end of the thread, so one
 * page is almost always enough.
 */
export async function fetchRecentComments(
  issueKey: string,
  maxPages = 1,
  signal?: AbortSignal,
): Promise<CommentPageResult> {
  const comments: JiraComment[] = [];
  let total = 0;

  for (let page = 0; page < maxPages; page += 1) {
    const result = await jiraRequest<JiraCommentPage>(
      `/rest/api/3/issue/${encodeURIComponent(issueKey)}/comment`,
      {
        searchParams: {
          startAt: page * PAGE_SIZE,
          maxResults: PAGE_SIZE,
          orderBy: '-created',
        },
        signal,
      },
    );

    total = result.total;
    comments.push(...result.comments);

    if (comments.length >= total) break;
  }

  return { comments, total, truncated: comments.length < total };
}
