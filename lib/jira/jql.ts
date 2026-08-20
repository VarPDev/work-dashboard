/**
 * JQL helpers. The instance rejects unbounded queries, so every query built
 * here carries at least one restricting clause.
 */

/**
 * Quote a value for use as a JQL string literal.
 *
 * accountIds look like "712020:aaaaaaaa-bbbb-..." — the colon makes them invalid as
 * a bare JQL token, so they must always go through here.
 */
export function jqlString(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/**
 * Reject anything that cannot be a Jira accountId before it reaches a query.
 * Real ids are either a 24-char hex string (legacy) or "<numeric>:<uuid>".
 */
export function isPlausibleAccountId(value: string): boolean {
  return /^[a-zA-Z0-9]{24}$/.test(value) || /^\d+:[0-9a-f-]{36}$/i.test(value);
}

/** Issues assigned to the target user that are not in a final status. */
export function assignedOpenJql(accountId: string): string {
  return `assignee = ${jqlString(accountId)} AND statusCategory != Done`;
}

/**
 * Candidates for "mentioned me and I have not replied": recently touched issues
 * that are not the target user's own, where their accountId shows up in a
 * comment. `comment ~` is a text match over the comment index, which does store
 * mention accountIds on this instance — but it tokenizes, so the ADF check is
 * what actually confirms a mention.
 */
export function mentionCandidatesJql(accountId: string, windowDays: number): string {
  const id = jqlString(accountId);
  // `assignee != X` alone would also drop unassigned issues, because JQL treats
  // EMPTY as not comparable — and a mention on an unassigned issue is exactly
  // the kind of thing that needs answering.
  return `updated >= -${windowDays}d AND (assignee != ${id} OR assignee IS EMPTY) AND comment ~ ${id}`;
}
