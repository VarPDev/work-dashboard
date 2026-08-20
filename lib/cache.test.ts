import { beforeEach, describe, expect, it, vi } from 'vitest';

import { cached, cachedAt, cacheKeys, cacheSnapshot, invalidate } from './cache';
import { invalidateForRefresh } from './tasks';

const ALICE = '712020:11111111-1111-1111-1111-111111111111';
const BOB = '712020:22222222-2222-2222-2222-222222222222';

beforeEach(() => {
  invalidate();
  vi.useRealTimers();
});

describe('cache keys', () => {
  it('gives every user their own task key', () => {
    expect(cacheKeys.tasks(ALICE)).not.toBe(cacheKeys.tasks(BOB));
  });

  it('embeds the accountId in the task key', () => {
    expect(cacheKeys.tasks(ALICE)).toContain(ALICE);
  });

  it('is stable for the same accountId', () => {
    expect(cacheKeys.tasks(ALICE)).toBe(cacheKeys.tasks(ALICE));
  });

  it('keeps user-independent keys out of the task namespace', () => {
    expect(cacheKeys.users().startsWith('tasks:')).toBe(false);
    expect(cacheKeys.boards().startsWith('tasks:')).toBe(false);
    expect(cacheKeys.priorities().startsWith('tasks:')).toBe(false);
  });
});

/**
 * The failure this guards against: showing one person's tasks under another
 * person's name. Everything else in this app is a cosmetic bug next to it.
 */
describe('per-user isolation', () => {
  it('never serves one user the other user payload', async () => {
    const load = (accountId: string) => async () => ({ owner: accountId });

    const alice = await cached(cacheKeys.tasks(ALICE), 60_000, load(ALICE));
    const bob = await cached(cacheKeys.tasks(BOB), 60_000, load(BOB));

    expect(alice.owner).toBe(ALICE);
    expect(bob.owner).toBe(BOB);

    // Second read, now from cache, must still be the right owner.
    const aliceAgain = await cached(cacheKeys.tasks(ALICE), 60_000, load(BOB));
    expect(aliceAgain.owner).toBe(ALICE);
  });

  it('does not let one user loader run for the other key', async () => {
    const calls: string[] = [];
    const load = (accountId: string) => async () => {
      calls.push(accountId);
      return accountId;
    };

    await cached(cacheKeys.tasks(ALICE), 60_000, load(ALICE));
    await cached(cacheKeys.tasks(ALICE), 60_000, load(ALICE));
    await cached(cacheKeys.tasks(BOB), 60_000, load(BOB));

    expect(calls).toEqual([ALICE, BOB]);
  });

  it('invalidating one user leaves the other cached', async () => {
    await cached(cacheKeys.tasks(ALICE), 60_000, async () => 'alice-v1');
    await cached(cacheKeys.tasks(BOB), 60_000, async () => 'bob-v1');

    invalidate(cacheKeys.tasks(ALICE));

    expect(await cached(cacheKeys.tasks(ALICE), 60_000, async () => 'alice-v2')).toBe('alice-v2');
    expect(await cached(cacheKeys.tasks(BOB), 60_000, async () => 'bob-v2')).toBe('bob-v1');
  });

  it('clears every user with the tasks prefix', async () => {
    await cached(cacheKeys.tasks(ALICE), 60_000, async () => 'a');
    await cached(cacheKeys.tasks(BOB), 60_000, async () => 'b');
    await cached(cacheKeys.users(), 60_000, async () => 'users');

    invalidate('tasks:');

    expect(cacheSnapshot()).toEqual([cacheKeys.users()]);
  });
});

describe('what a refresh invalidates', () => {
  async function fillCache(): Promise<void> {
    await cached(cacheKeys.tasks(ALICE), 60_000, async () => 'alice');
    await cached(cacheKeys.tasks(BOB), 60_000, async () => 'bob');
    await cached(cacheKeys.boards(), 60_000, async () => 'boards');
    await cached(cacheKeys.priorities(), 60_000, async () => 'priorities');
    await cached(cacheKeys.users(), 60_000, async () => 'users');
  }

  it('drops the board and priority lists, not just the tasks', async () => {
    // Otherwise a board created since the last load stays invisible for an hour,
    // and every issue on it reads as "Senza board".
    await fillCache();
    invalidateForRefresh(ALICE);

    expect(cacheSnapshot()).not.toContain(cacheKeys.boards());
    expect(cacheSnapshot()).not.toContain(cacheKeys.priorities());
    expect(cacheSnapshot()).not.toContain(cacheKeys.tasks(ALICE));
  });

  it('leaves the other user tasks and the user list alone', async () => {
    await fillCache();
    invalidateForRefresh(ALICE);

    expect(cacheSnapshot()).toContain(cacheKeys.tasks(BOB));
    expect(cacheSnapshot()).toContain(cacheKeys.users());
  });
});

describe('cache behaviour', () => {
  it('returns the cached value without calling the loader again', async () => {
    const load = vi.fn(async () => 'value');
    await cached('k', 60_000, load);
    await cached('k', 60_000, load);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('refetches once the TTL has passed', async () => {
    vi.useFakeTimers();
    const load = vi.fn(async () => 'value');

    await cached('k', 1_000, load);
    vi.advanceTimersByTime(1_001);
    await cached('k', 1_000, load);

    expect(load).toHaveBeenCalledTimes(2);
  });

  it('does not cache a failed load', async () => {
    const load = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('jira exploded'))
      .mockResolvedValueOnce('recovered');

    await expect(cached('k', 60_000, load)).rejects.toThrow('jira exploded');
    await expect(cached('k', 60_000, load)).resolves.toBe('recovered');
  });

  it('shares one in-flight load between concurrent callers', async () => {
    let resolve: (value: string) => void = () => {};
    const load = vi.fn(
      () =>
        new Promise<string>((res) => {
          resolve = res;
        }),
    );

    const first = cached('k', 60_000, load);
    const second = cached('k', 60_000, load);
    resolve('once');

    expect(await first).toBe('once');
    expect(await second).toBe('once');
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('reports when a value was stored, and nothing once it expired', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-20T10:00:00.000Z'));

    await cached('k', 60_000, async () => 'value');
    expect(cachedAt('k', 60_000)?.toISOString()).toBe('2026-08-20T10:00:00.000Z');

    vi.advanceTimersByTime(60_001);
    expect(cachedAt('k', 60_000)).toBeNull();
  });
});
