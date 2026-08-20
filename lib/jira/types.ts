/**
 * Jira Cloud REST API v3 shapes, narrowed to what this dashboard actually asks
 * for. Anything not requested via `fields` is intentionally absent from the
 * types, so a missing field is a compile error rather than a runtime surprise.
 */

export type JiraAvatarUrls = {
  '16x16': string;
  '24x24': string;
  '32x32': string;
  '48x48': string;
};

/** `accountType` is "atlassian" for humans, "app" for integrations, "customer" for JSM portal users. */
export type JiraAccountType = 'atlassian' | 'app' | 'customer';

export type JiraUser = {
  accountId: string;
  accountType: JiraAccountType;
  displayName: string;
  active: boolean;
  /** Absent in GDPR strict mode. Never rely on it for identity. */
  emailAddress?: string;
  avatarUrls?: JiraAvatarUrls;
};

export type JiraStatusCategoryKey = 'new' | 'indeterminate' | 'done' | 'undefined';

export type JiraStatusCategory = {
  id: number;
  key: JiraStatusCategoryKey;
  name: string;
  colorName: string;
};

export type JiraStatus = {
  id: string;
  name: string;
  statusCategory: JiraStatusCategory;
};

export type JiraPriority = {
  id: string;
  name: string;
  iconUrl?: string;
};

export type JiraIssueType = {
  id: string;
  name: string;
  subtask: boolean;
  iconUrl?: string;
};

export type JiraProject = {
  id: string;
  key: string;
  name: string;
  avatarUrls?: JiraAvatarUrls;
};

export type JiraIssueParent = {
  id: string;
  key: string;
  fields: {
    summary: string;
    status?: JiraStatus;
    issuetype?: JiraIssueType;
  };
};

export type JiraIssueFields = {
  summary: string;
  status: JiraStatus;
  /** Null when the project makes priority optional. */
  priority: JiraPriority | null;
  /** ISO date, no time component. Null when unset. */
  duedate: string | null;
  project: JiraProject;
  issuetype: JiraIssueType;
  assignee: JiraUser | null;
  /** ISO timestamp with offset. */
  updated: string;
  labels: string[];
  parent?: JiraIssueParent;
};

export type JiraIssue = {
  id: string;
  key: string;
  fields: JiraIssueFields;
};

/**
 * Atlassian Document Format node. Deliberately loose on `attrs`, because each
 * node type carries its own attribute bag; mention detection narrows it where
 * it matters.
 */
export type AdfNode = {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: AdfNode[];
  marks?: { type: string; attrs?: Record<string, unknown> }[];
};

export type JiraComment = {
  id: string;
  /** API URL of the comment, not the browser one. */
  self: string;
  author: JiraUser;
  /** ADF when the API is asked for v3 output, a wiki-markup string on legacy comments. */
  body: AdfNode | string;
  created: string;
  updated: string;
};

/** `/issue/{key}/comment` still paginates the old way. */
export type JiraCommentPage = {
  comments: JiraComment[];
  startAt: number;
  maxResults: number;
  total: number;
};

/**
 * `POST /search/jql` response. The legacy `startAt`/`total` pagination was
 * removed from this instance (410), so only the token cursor exists.
 */
export type JiraSearchPage = {
  issues: JiraIssue[];
  nextPageToken?: string;
  isLast?: boolean;
};

export type JiraApproximateCount = {
  count: number;
};

export type JiraBoard = {
  id: number;
  name: string;
  type: 'scrum' | 'kanban' | 'simple';
  location?: {
    projectId?: number;
    projectKey?: string;
    projectName?: string;
  };
};

/** Agile API pages, which really do use startAt/maxResults. */
export type JiraAgilePage<T> = {
  values: T[];
  startAt: number;
  maxResults: number;
  total?: number;
  isLast?: boolean;
};

/** Error payload Jira returns on 4xx/5xx. */
export type JiraErrorBody = {
  errorMessages?: string[];
  errors?: Record<string, string>;
  message?: string;
};
