/**
 * The user directory has to survive a token that cannot browse users: the whole
 * dashboard hangs off resolveTargetUser, so a 403 here used to take every route
 * down with it.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { invalidate } from '@/lib/cache';

import { JiraApiError } from './client';

const DEFAULT_ID = '712020:11111111-1111-1111-1111-111111111111';
const OTHER_ID = '712020:22222222-2222-2222-2222-222222222222';

const jiraRequest = vi.hoisted(() => vi.fn());

vi.mock('./client', async () => {
  const actual = await vi.importActual<typeof import('./client')>('./client');
  return { ...actual, jiraRequest };
});

vi.mock('./env', () => ({
  getJiraConfig: () => ({
    baseUrl: 'https://example.atlassian.net',
    email: 'service@example.com',
    apiToken: 'token',
    authMode: 'basic' as const,
    defaultAccountId: DEFAULT_ID,
  }),
}));

const { OtherUsersHiddenError, UnknownUserError, getUserDirectory, resolveTargetUser } =
  await import('./users');

function jiraUser(accountId: string, displayName: string) {
  return {
    accountId,
    accountType: 'atlassian',
    displayName,
    active: true,
    avatarUrls: { '48x48': `https://avatars/${accountId}` },
  };
}

/** What Jira answers on /users/search without the "Browse users" permission. */
function forbidden() {
  return new JiraApiError(403, '/rest/api/3/users/search', [
    'You do not have permission to browse users.',
  ]);
}

beforeEach(() => {
  // The directory is cached for an hour, so every test starts from cold.
  invalidate();
  jiraRequest.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the full directory', () => {
  it('lists the active atlassian accounts, sorted, and is not restricted', async () => {
    jiraRequest.mockResolvedValueOnce([
      jiraUser(OTHER_ID, 'Zoe Zanetti'),
      jiraUser(DEFAULT_ID, 'Anna Alber'),
      { ...jiraUser('712020:33333333-3333-3333-3333-333333333333', 'Bot'), accountType: 'app' },
      { ...jiraUser('712020:44444444-4444-4444-4444-444444444444', 'Gone'), active: false },
    ]);

    const directory = await getUserDirectory();

    expect(directory.restricted).toBe(false);
    expect(directory.users.map((user) => user.displayName)).toEqual(['Anna Alber', 'Zoe Zanetti']);
  });
});

describe('a token that cannot browse users', () => {
  it('falls back to the default account, named from /myself', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    jiraRequest
      .mockRejectedValueOnce(forbidden())
      .mockResolvedValueOnce(jiraUser(DEFAULT_ID, 'Anna Alber'));

    const directory = await getUserDirectory();

    expect(directory.restricted).toBe(true);
    expect(directory.users).toEqual([
      {
        accountId: DEFAULT_ID,
        displayName: 'Anna Alber',
        avatarUrl: `https://avatars/${DEFAULT_ID}`,
        active: true,
      },
    ]);
  });

  it('asks for the default account by id when the token is somebody else', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    jiraRequest
      .mockRejectedValueOnce(forbidden())
      // /myself: the shared service account, not the configured person.
      .mockResolvedValueOnce(jiraUser(OTHER_ID, 'Service Account'))
      .mockResolvedValueOnce(jiraUser(DEFAULT_ID, 'Anna Alber'));

    const directory = await getUserDirectory();

    expect(directory.restricted).toBe(true);
    expect(directory.users.map((user) => user.displayName)).toEqual(['Anna Alber']);
  });

  it('still offers the default account when no name can be found at all', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    jiraRequest
      .mockRejectedValueOnce(forbidden())
      .mockRejectedValueOnce(forbidden())
      .mockRejectedValueOnce(forbidden());

    const directory = await getUserDirectory();

    expect(directory.restricted).toBe(true);
    expect(directory.users).toEqual([
      { accountId: DEFAULT_ID, displayName: DEFAULT_ID, avatarUrl: null, active: true },
    ]);
  });

  it('resolves the default user, so the dashboard loads', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    jiraRequest
      .mockRejectedValueOnce(forbidden())
      .mockResolvedValueOnce(jiraUser(DEFAULT_ID, 'Anna Alber'));

    await expect(resolveTargetUser(null)).resolves.toMatchObject({
      accountId: DEFAULT_ID,
      displayName: 'Anna Alber',
    });
  });

  it('refuses anybody else instead of querying an unverifiable accountId', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    jiraRequest
      .mockRejectedValueOnce(forbidden())
      .mockResolvedValueOnce(jiraUser(DEFAULT_ID, 'Anna Alber'));

    await expect(resolveTargetUser(OTHER_ID)).rejects.toBeInstanceOf(OtherUsersHiddenError);
    // Every route already refuses an unresolvable id; this one comes along.
    await expect(resolveTargetUser(OTHER_ID)).rejects.toBeInstanceOf(UnknownUserError);
  });
});

describe('a directory that fails for another reason', () => {
  it('propagates the error rather than pretending the token is restricted', async () => {
    jiraRequest.mockRejectedValue(new JiraApiError(500, '/rest/api/3/users/search', ['boom']));

    await expect(getUserDirectory()).rejects.toBeInstanceOf(JiraApiError);
  });
});
