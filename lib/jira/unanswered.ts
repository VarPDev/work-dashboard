/**
 * Source B: issues where the target user was mentioned and has not replied.
 *
 * JQL alone cannot answer this, so it is a two-step: a cheap query to narrow the
 * field, then a comment scan per candidate. That scan is the expensive part —
 * one Jira call per candidate — hence the cap and the concurrency limit.
 */

import { MENTION_CANDIDATE_LIMIT, MENTION_FETCH_CONCURRENCY, MENTION_WINDOW_DAYS } from '@/config/app';
import { mapWithConcurrency } from '@/lib/concurrency';

import { fetchRecentComments } from './comments';
import { getJiraConfig } from './env';
import { mentionCandidatesJql } from './jql';
import { analyzeMentions, threadMentionsAccount, type MentionAnalysis } from './mentions';
import { searchIssues } from './search';
import type { JiraIssue, JiraUser } from './types';

/** How deep to dig into a long thread before giving up on finding the mention. */
const MAX_COMMENT_PAGES = 3;

export type UnansweredMention = {
  issue: JiraIssue;
  mentionedBy: JiraUser;
  mentionText: string;
  mentionedAt: string;
  /** Identifies which mention this is, so a dismissal can expire on a newer one. */
  commentId: string;
  commentUrl: string;
};

export type UnansweredMentionsResult = {
  mentions: UnansweredMention[];
  /** Candidates the JQL returned, before the ADF check. */
  candidateCount: number;
  /** Candidates where the mention exists but was already answered. */
  answeredCount: number;
  /** Candidates where the target only appears on a "fyi" line. */
  informationalOnlyCount: number;
  /** Candidates dropped because `comment ~` matched text that is not a mention. */
  falsePositiveCount: number;
  /** Threads too long to scan fully — their mention may have been missed. */
  truncatedThreads: string[];
};

function commentUrl(baseUrl: string, issueKey: string, commentId: string): string {
  return `${baseUrl}/browse/${issueKey}?focusedCommentId=${commentId}`;
}

/**
 * Scan one candidate. Pages backwards through the thread until the mention is
 * found, because a mention found on page 1 already has every later comment in
 * hand — which is what decides "replied".
 */
async function scanCandidate(
  issue: JiraIssue,
  accountId: string,
  signal?: AbortSignal,
): Promise<{ analysis: MentionAnalysis | null; mentionedAtAll: boolean; truncated: boolean }> {
  for (let pages = 1; pages <= MAX_COMMENT_PAGES; pages += 1) {
    const { comments, truncated } = await fetchRecentComments(issue.key, pages, signal);
    const analysis = analyzeMentions(comments, accountId);

    // A mention found on the newest page already has every later comment in
    // hand, so whether it was answered is decided.
    if (analysis) return { analysis, mentionedAtAll: true, truncated: false };

    // No mention in what we have: if the whole thread is here that is final,
    // otherwise reach further back.
    const mentionedAtAll = threadMentionsAccount(comments, accountId);
    if (!truncated) return { analysis: null, mentionedAtAll, truncated: false };
    if (pages === MAX_COMMENT_PAGES) return { analysis: null, mentionedAtAll, truncated: true };
  }

  return { analysis: null, mentionedAtAll: false, truncated: true };
}

export async function getUnansweredMentions(
  accountId: string,
  signal?: AbortSignal,
): Promise<UnansweredMentionsResult> {
  const { baseUrl } = getJiraConfig();

  const candidates = await searchIssues({
    jql: mentionCandidatesJql(accountId, MENTION_WINDOW_DAYS),
    limit: MENTION_CANDIDATE_LIMIT,
    signal,
  });

  const scans = await mapWithConcurrency(candidates, MENTION_FETCH_CONCURRENCY, (issue) =>
    scanCandidate(issue, accountId, signal),
  );

  const mentions: UnansweredMention[] = [];
  const truncatedThreads: string[] = [];
  let falsePositiveCount = 0;
  let answeredCount = 0;
  let informationalOnlyCount = 0;

  scans.forEach((scan, index) => {
    const issue = candidates[index];
    if (scan.truncated) truncatedThreads.push(issue.key);

    if (!scan.analysis) {
      // Mentioned, but never actually asked anything: a "fyi" line, or only
      // self-mentions. Otherwise `comment ~ accountId` matched plain text that
      // is not a mention node at all.
      if (scan.mentionedAtAll) informationalOnlyCount += 1;
      else falsePositiveCount += 1;
      return;
    }

    if (scan.analysis.replied) {
      answeredCount += 1;
      return;
    }

    mentions.push({
      issue,
      mentionedBy: scan.analysis.mentionedBy,
      mentionText: scan.analysis.mentionText,
      mentionedAt: scan.analysis.mentionedAt,
      commentId: scan.analysis.commentId,
      commentUrl: commentUrl(baseUrl, issue.key, scan.analysis.commentId),
    });
  });

  return {
    mentions,
    candidateCount: candidates.length,
    answeredCount,
    informationalOnlyCount,
    falsePositiveCount,
    truncatedThreads,
  };
}
