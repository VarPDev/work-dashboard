/**
 * In-memory TTL cache. Deliberately hand-rolled rather than unstable_cache:
 * the cache key isolation between users is the one thing in this app that must
 * be provable by a test, and a plain Map is testable without a Next runtime.
 *
 * The process is a single local dev server, so a module-level Map is the whole
 * story — no eviction policy beyond the TTL.
 */

type Entry = {
  value: unknown;
  expiresAt: number;
};

const entries = new Map<string, Entry>();
/** In-flight loads, so a double click on refresh does not double the Jira calls. */
const pending = new Map<string, Promise<unknown>>();

/**
 * Cache keys live here, in one place, because every one of them must carry the
 * accountId it belongs to. Showing one person's tasks under another person's
 * name is the worst failure this app can have.
 */
export const cacheKeys = {
  users: (): string => 'users:v1',
  tasks: (accountId: string): string => `tasks:v1:${accountId}`,
  boards: (): string => 'boards:v1',
  priorities: (): string => 'priorities:v1',
} as const;

export async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = entries.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    return hit.value as T;
  }

  const inFlight = pending.get(key);
  if (inFlight) return inFlight as Promise<T>;

  const load$ = load()
    .then((value) => {
      // A rejected load must not be cached, so this only runs on success.
      entries.set(key, { value, expiresAt: Date.now() + ttlMs });
      return value;
    })
    .finally(() => {
      pending.delete(key);
    });

  pending.set(key, load$);
  return load$;
}

/** Drop one key, or everything under a prefix (`invalidate('tasks:')`). */
export function invalidate(keyOrPrefix?: string): void {
  if (keyOrPrefix === undefined) {
    entries.clear();
    return;
  }
  if (entries.delete(keyOrPrefix)) return;
  for (const key of entries.keys()) {
    if (key.startsWith(keyOrPrefix)) entries.delete(key);
  }
}

/** When the cached value was stored, so the UI can show "last updated". */
export function cachedAt(key: string, ttlMs: number): Date | null {
  const hit = entries.get(key);
  if (!hit || hit.expiresAt <= Date.now()) return null;
  return new Date(hit.expiresAt - ttlMs);
}

/** Test and debug helper. */
export function cacheSnapshot(): string[] {
  return [...entries.keys()].sort();
}
