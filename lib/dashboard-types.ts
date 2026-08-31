/**
 * The contract between the API routes and the browser.
 *
 * These types live on their own, away from anything that reads the environment,
 * so a client component can import them without dragging server code — and the
 * token — anywhere near the bundle.
 */

export type SelectableUser = {
  accountId: string;
  displayName: string;
  avatarUrl: string | null;
  active: boolean;
};

export type TaskKind = 'assigned' | 'mention';

export type DashboardIssue = {
  key: string;
  url: string;
  summary: string;
  status: { name: string; category: string };
  priority: { id: string; name: string } | null;
  duedate: string | null;
  project: { key: string; name: string };
  issueType: string;
  assignee: { displayName: string; avatarUrl: string | null } | null;
  updated: string;
  labels: string[];
  parentKey: string | null;
};

export type DashboardMention = {
  /** Which comment this mention is, used as the dismissal watermark. */
  commentId: string;
  byDisplayName: string;
  byAvatarUrl: string | null;
  text: string;
  at: string;
  commentUrl: string;
  /**
   * The mention only keeps the user in the loop — a "fyi" / "cc" line. Nothing
   * is being asked, so the UI files it under its own collapsed group instead of
   * mixing it into the work.
   */
  informational: boolean;
};

export type ItemBoard = {
  /** `board:<id>` or `project:<KEY>` for issues on no board. */
  id: string;
  label: string;
  kind: 'board' | 'project';
};

export type DashboardItem = {
  kind: TaskKind;
  issue: DashboardIssue;
  mention: DashboardMention | null;
  board: ItemBoard;
  overdue: boolean;
  dueSoon: boolean;
};

export type BoardFacet = ItemBoard & {
  count: number;
  overdueCount: number;
};

/** Call budget and mention signal quality, surfaced so it can be watched. */
export type DashboardDiagnostics = {
  jiraCalls: number;
  mentionCandidates: number;
  mentionsAlreadyAnswered: number;
  /** Shown, but only on a "fyi" line: kept in the loop, not asked anything. */
  mentionsInformationalOnly: number;
  mentionFalsePositives: number;
  truncatedThreads: string[];
  boardsQueried: number;
  boardsTotal: number;
  failedBoards: string[];
};

export type DashboardPayload = {
  user: SelectableUser;
  /** Whether this user is the configured default — "me". */
  isDefaultUser: boolean;
  generatedAt: string;
  /** `mentions` counts the ones that ask something; "fyi" lines are `informational`. */
  totals: { assigned: number; mentions: number; informational: number; overdue: number };
  /** One flat list, already sorted. Board is a column and a filter, not a section. */
  items: DashboardItem[];
  diagnostics: DashboardDiagnostics;
};

export type UsersResponse = {
  defaultAccountId: string;
  users: SelectableUser[];
  /**
   * The token cannot browse users, so `users` holds the default account alone.
   * Not an error: the dashboard works, it just has nobody else to offer.
   */
  restricted: boolean;
};

export type ApiError = {
  error: {
    code: 'other-users-hidden' | 'unknown-user' | 'jira-error' | 'config-error';
    message: string;
  };
};
