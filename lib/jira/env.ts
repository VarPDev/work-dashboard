/**
 * Jira credentials, read from the environment once. Server side only.
 */

export type JiraAuthMode = 'basic' | 'bearer';

export type JiraConfig = {
  baseUrl: string;
  email: string;
  apiToken: string;
  authMode: JiraAuthMode;
  /**
   * Whose workload the dashboard shows when no user is selected. The token on
   * this instance belongs to a shared service account, so /myself is the wrong
   * default and this is configured explicitly instead.
   */
  defaultAccountId: string;
};

/**
 * Nothing in here may reach the browser. The modules that import this are only
 * ever pulled in from route handlers and server components; this guard catches
 * an accidental client import at runtime.
 */
function assertServerSide(): void {
  if (typeof window !== 'undefined') {
    throw new Error('lib/jira must never be imported from client code.');
  }
}

/** Accept both "example.atlassian.net" and "https://example.atlassian.net/". */
export function normalizeBaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

let cached: JiraConfig | null = null;

export function getJiraConfig(): JiraConfig {
  assertServerSide();
  if (cached) return cached;

  const baseUrl = normalizeBaseUrl(process.env.JIRA_BASE_URL ?? '');
  const email = (process.env.JIRA_EMAIL ?? '').trim();
  const apiToken = (process.env.JIRA_API_TOKEN ?? '').trim();
  const authMode = (process.env.JIRA_AUTH_MODE ?? 'basic').trim().toLowerCase();
  const defaultAccountId = (process.env.JIRA_DEFAULT_ACCOUNT_ID ?? '').trim();

  const missing = Object.entries({
    JIRA_BASE_URL: baseUrl,
    JIRA_EMAIL: email,
    JIRA_API_TOKEN: apiToken,
    JIRA_DEFAULT_ACCOUNT_ID: defaultAccountId,
  })
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length) {
    throw new Error(`Missing environment variables in .env.local: ${missing.join(', ')}`);
  }
  if (authMode !== 'basic' && authMode !== 'bearer') {
    throw new Error(`JIRA_AUTH_MODE must be "basic" or "bearer", got "${authMode}".`);
  }

  cached = { baseUrl, email, apiToken, authMode, defaultAccountId };
  return cached;
}

export function authorizationHeader(config: JiraConfig): string {
  return config.authMode === 'basic'
    ? `Basic ${Buffer.from(`${config.email}:${config.apiToken}`).toString('base64')}`
    : `Bearer ${config.apiToken}`;
}
