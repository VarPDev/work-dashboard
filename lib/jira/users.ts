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

/**
 * The picker list, plus whether it is the whole truth.
 *
 * `restricted` means the token lacks the global "Browse users" permission, so
 * the list holds the configured default account and nothing else. The dashboard
 * still works — every Jira query runs by accountId, which needs no directory —
 * it just cannot offer anybody else.
 */
export type UserDirectory = {
  users: SelectableUser[];
  restricted: boolean;
};

function toSelectable(user: JiraUser): SelectableUser {
  return {
    accountId: user.accountId,
    displayName: user.displayName,
    // 48px is what the picker and the header banner render.
    avatarUrl: user.avatarUrls?.['48x48'] ?? null,
    active: user.active,
  };
}

/** Missing "Browse users" is a 403; anything else is a real failure. */
function isDirectoryForbidden(error: unknown): boolean {
  return error instanceof JiraApiError && error.status === 403;
}

/**
 * Best effort name and avatar for the configured default account when the
 * directory is off limits. Never throws: a placeholder beats an empty picker.
 */
async function defaultAccountOnly(defaultAccountId: string): Promise<SelectableUser> {
  // /myself needs no permission at all. When the token belongs to the very
  // person the dashboard is configured for — a personal token rather than the
  // shared service account — this is the real identity, avatar included.
  try {
    const me = await jiraRequest<JiraUser>('/rest/api/3/myself');
    if (me.accountId === defaultAccountId) return toSelectable(me);
  } catch {
    // Fall through: the placeholder below is always available.
  }

  // A different account, so ask for it by id. Same permission as the bulk list,
  // so this usually fails too — but it costs one call an hour, and it is the
  // only way to get a name when the instance does allow single lookups.
  try {
    return toSelectable(await getUserByAccountId(defaultAccountId));
  } catch {
    // Fall through.
  }

  // No name to be had anywhere. Show the id: honest, and still selectable.
  return {
    accountId: defaultAccountId,
    displayName: defaultAccountId,
    avatarUrl: null,
    active: true,
  };
}

/**
 * The whole user directory in one call. This instance has 544 accounts of which
 * 99 are active humans, so fetching the list once an hour and filtering in the
 * browser beats proxying a query per keystroke.
 *
 * Requires the global "Browse users" permission. Without it the app must not
 * fall over: it degrades to the one account it was configured for.
 */
export async function getUserDirectory(): Promise<UserDirectory> {
  const { defaultAccountId } = getJiraConfig();

  return cached(cacheKeys.users(), USERS_CACHE_TTL_MS, async () => {
    let users: JiraUser[];
    try {
      users = await jiraRequest<JiraUser[]>('/rest/api/3/users/search', {
        searchParams: { maxResults: 1000 },
      });
    } catch (error) {
      if (!isDirectoryForbidden(error)) throw error;

      console.warn(
        '[jira] the token cannot browse users: the picker falls back to ' +
          `JIRA_DEFAULT_ACCOUNT_ID (${defaultAccountId}) alone.`,
      );
      return { users: [await defaultAccountOnly(defaultAccountId)], restricted: true };
    }

    return {
      users: users
        .filter((user) => user.accountType === 'atlassian' && user.active)
        .map(toSelectable)
        .sort((a, b) => a.displayName.localeCompare(b.displayName)),
      restricted: false,
    };
  });
}

export async function getUserByAccountId(accountId: string): Promise<JiraUser> {
  return jiraRequest<JiraUser>('/rest/api/3/user', { searchParams: { accountId } });
}

export class UnknownUserError extends Error {
  readonly accountId: string;

  constructor(accountId: string, message?: string) {
    super(message ?? `No Jira user matches accountId "${accountId}".`);
    this.name = 'UnknownUserError';
    this.accountId = accountId;
  }
}

/**
 * Somebody else was asked for while the directory is restricted.
 *
 * A subclass of UnknownUserError on purpose: every route that already refuses an
 * accountId it cannot resolve keeps refusing this one, and /api/tasks can catch
 * the specific case first to say why.
 */
export class OtherUsersHiddenError extends UnknownUserError {
  constructor(accountId: string) {
    super(
      accountId,
      `The token cannot see other users, so accountId "${accountId}" cannot be resolved.`,
    );
    this.name = 'OtherUsersHiddenError';
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
  const directory = await getUserDirectory();
  const known = directory.users.find((user) => user.accountId === accountId);
  if (known) return known;

  // A restricted directory holds the default account and nothing else, and
  // without "Browse users" there is no endpoint left to check another id
  // against. Refuse rather than run JQL for an id nothing has verified.
  if (directory.restricted) {
    throw new OtherUsersHiddenError(accountId);
  }

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
