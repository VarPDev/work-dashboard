/**
 * Source A: issues assigned to the target user that are not done yet.
 */

import { assignedOpenJql } from './jql';
import { searchIssues } from './search';
import type { JiraIssue } from './types';

export async function getAssignedIssues(
  accountId: string,
  signal?: AbortSignal,
): Promise<JiraIssue[]> {
  // ORDER BY duedate ASC only sets the page order; the real sort (priority,
  // then due date with nulls last, then updated) happens in Phase 5 once the
  // priority ranking is known.
  return searchIssues({
    jql: `${assignedOpenJql(accountId)} ORDER BY duedate ASC`,
    signal,
  });
}
