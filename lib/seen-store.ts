/**
 * Where "already seen" lives: data/seen.json, keyed by accountId, same shape and
 * same reasoning as the dismissals store.
 *
 *   { "<accountId>": { "<ISSUE-KEY>": "comment:123" } }
 */

import { dataFilePath, readJsonFile, serialize, writeJsonFile } from './json-store';
import { parseSeen, type SeenState } from './seen';

type Store = Record<string, SeenState>;

export function seenFilePath(): string {
  return dataFilePath(process.env.SEEN_FILE, 'seen.json');
}

function parseStore(parsed: unknown): Store {
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};

  const store: Store = {};
  for (const [accountId, value] of Object.entries(parsed)) {
    store[accountId] = parseSeen(JSON.stringify(value));
  }
  return store;
}

function readStore(): Promise<Store> {
  return readJsonFile(seenFilePath(), parseStore, {}, 'seen');
}

export async function getSeen(accountId: string): Promise<SeenState> {
  return serialize(async () => (await readStore())[accountId] ?? {});
}

/** Acknowledge a list: what is stored is exactly what was on screen. */
export async function replaceSeen(accountId: string, seen: SeenState): Promise<SeenState> {
  return serialize(async () => {
    const store = await readStore();
    await writeJsonFile(seenFilePath(), { ...store, [accountId]: seen });
    return seen;
  });
}
