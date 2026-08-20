/**
 * "Someone mentioned me and I have not answered yet" — the rule, as pure
 * functions over a comment thread. No network, no env, so it is unit testable.
 *
 * Agreed definition: a reply is a *comment* by the target user created after the
 * mention. Status transitions do not count.
 */

import { bodyAddressesAccount, bodyMentionsAccount, bodyToPlainText } from './adf';
import type { JiraComment, JiraUser } from './types';

export type MentionAnalysis = {
  mentionedBy: JiraUser;
  mentionText: string;
  mentionedAt: string;
  commentId: string;
  /** True when the target user commented after being mentioned. */
  replied: boolean;
};

function byCreatedAscending(a: JiraComment, b: JiraComment): number {
  const left = Date.parse(a.created);
  const right = Date.parse(b.created);
  if (left !== right) return left - right;
  // Ids are monotonic in Jira, so they break ties deterministically.
  return Number(a.id) - Number(b.id);
}

/**
 * Find the most recent comment that actually asks `accountId` something, and
 * report whether they have commented since.
 *
 * Two kinds of mention do not count:
 *  - ones the target user wrote themselves — tagging yourself, or quoting a
 *    thread you are part of, owes nobody an answer;
 *  - ones that only appear on a "fyi" / "cc" line, which keep you in the loop
 *    rather than ask you anything.
 */
export function analyzeMentions(
  comments: readonly JiraComment[],
  accountId: string,
): MentionAnalysis | null {
  if (!accountId) return null;

  const ordered = [...comments].sort(byCreatedAscending);

  let lastMentionIndex = -1;
  for (let index = ordered.length - 1; index >= 0; index -= 1) {
    const comment = ordered[index];
    if (comment.author?.accountId === accountId) continue;
    if (bodyAddressesAccount(comment.body, accountId)) {
      lastMentionIndex = index;
      break;
    }
  }

  if (lastMentionIndex === -1) return null;

  const mention = ordered[lastMentionIndex];
  const replied = ordered
    .slice(lastMentionIndex + 1)
    .some((comment) => comment.author?.accountId === accountId);

  return {
    mentionedBy: mention.author,
    mentionText: bodyToPlainText(mention.body),
    mentionedAt: mention.created,
    commentId: mention.id,
    replied,
  };
}

/** The mention only if it is still waiting for an answer. */
export function findUnansweredMention(
  comments: readonly JiraComment[],
  accountId: string,
): MentionAnalysis | null {
  const analysis = analyzeMentions(comments, accountId);
  return analysis && !analysis.replied ? analysis : null;
}

/** Whether the thread mentions the account at all, ignoring self-mentions. */
export function threadMentionsAccount(
  comments: readonly JiraComment[],
  accountId: string,
): boolean {
  return comments.some(
    (comment) =>
      comment.author?.accountId !== accountId && bodyMentionsAccount(comment.body, accountId),
  );
}
