/**
 * The user picker, and the validation that stands between a URL parameter and a
 * JQL query.
 */

import { USERS_CACHE_TTL_MS } from '@/config/app';
import { cached, cacheKeys } from '@/lib/cache';
import type { SelectableUser } from '@/lib/dashboard-types';

import { JiraApiError, jiraRequest } from './client';
import { getJiraConfig } from './env';
import { isPlausibleAccountId } from './jql';
import type { JiraUser } from './types';

/**
 * Trimmed user shape: everything the UI needs, nothing the UI does not. Defined
 * in lib/dashboard-types.ts, which the browser can import safely.
 */
export type { SelectableUser };

function toSelectable(user: JiraUser): SelectableUser {
  return {
    accountId: user.accountId,
    displayName: user.displayName,
    // 48px is what the picker and the header banner render.
    avatarUrl: user.avatarUrls?.['48x48'] ?? null,
    active: user.active,
  };
}

/**
 * The whole user directory in one call. This instance has 544 accounts of which
 * 99 are active humans, so fetching the list once an hour and filtering in the
 * browser beats proxying a query per keystroke.
 *
 * Requires the global "Browse users" permission; a 403 is passed through so the
 * UI can say so instead of rendering an empty picker.
 */
export async function getSelectableUsers(): Promise<SelectableUser[]> {
  return cached(cacheKeys.users(), USERS_CACHE_TTL_MS, async () => {
    const users = await jiraRequest<JiraUser[]>('/rest/api/3/users/search', {
      searchParams: { maxResults: 1000 },
    });

    return users
      .filter((user) => user.accountType === 'atlassian' && user.active)
      .map(toSelectable)
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  });
}

export async function getUserByAccountId(accountId: string): Promise<JiraUser> {
  return jiraRequest<JiraUser>('/rest/api/3/user', { searchParams: { accountId } });
}

export class UnknownUserError extends Error {
  readonly accountId: string;

  constructor(accountId: string) {
    super(`No Jira user matches accountId "${accountId}".`);
    this.name = 'UnknownUserError';
    this.accountId = accountId;
  }
}

/**
 * Turn a requested accountId into a real user, or fail loudly.
 *
 * This matters more than it looks: JQL answers 200 with an empty issue list for
 * an accountId that does not exist, so without this check a typo in `?user=`
 * renders a plausible, completely empty dashboard. `/rest/api/3/user` does 404
 * on an unknown id, which is what makes the check possible.
 */
export async function resolveTargetUser(requested?: string | null): Promise<SelectableUser> {
  const { defaultAccountId } = getJiraConfig();
  const accountId = (requested ?? '').trim() || defaultAccountId;

  if (!isPlausibleAccountId(accountId)) {
    throw new UnknownUserError(accountId);
  }

  // The picker list is cached anyway, so the common case costs no Jira call.
  const known = (await getSelectableUsers()).find((user) => user.accountId === accountId);
  if (known) return known;

  // Not in the picker list: could be an inactive or otherwise hidden account.
  // Ask Jira directly rather than pretending the user has nothing to do.
  try {
    return toSelectable(await getUserByAccountId(accountId));
  } catch (error) {
    if (error instanceof JiraApiError && (error.status === 404 || error.status === 400)) {
      throw new UnknownUserError(accountId);
    }
    throw error;
  }
}
