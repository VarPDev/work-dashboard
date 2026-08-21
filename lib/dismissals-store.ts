/**
 * Where dismissals live: one JSON file on disk, written by the server.
 *
 * A file rather than browser storage, so the choice survives a different
 * browser, a cleared cache and a reboot; a file rather than a database, because
 * this is a handful of kilobytes of one person's reading state.
 *
 * Shape:
 *   { "<accountId>": { "<ISSUE-KEY>": "<commentId>" } }
 *
 * The accountId is the top-level key, so a dismissal made while looking at a
 * colleague can never hide anything of yours.
 */

import { parseDismissals, type Dismissals } from './dismissals';
import { dataFilePath, readJsonFile, serialize, writeJsonFile } from './json-store';

type Store = Record<string, Dismissals>;

export function dismissalsFilePath(): string {
  // Overridable so tests do not touch the real file.
  return dataFilePath(process.env.DISMISSALS_FILE, 'dismissals.json');
}

function parseStore(parsed: unknown): Store {
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};

  const store: Store = {};
  for (const [accountId, value] of Object.entries(parsed)) {
    store[accountId] = parseDismissals(JSON.stringify(value));
  }
  return store;
}

function readStore(): Promise<Store> {
  return readJsonFile(dismissalsFilePath(), parseStore, {}, 'dismissals');
}

export async function getDismissals(accountId: string): Promise<Dismissals> {
  return serialize(async () => (await readStore())[accountId] ?? {});
}

export async function setDismissal(
  accountId: string,
  issueKey: string,
  commentId: string,
): Promise<Dismissals> {
  return serialize(async () => {
    const store = await readStore();
    const next = { ...(store[accountId] ?? {}), [issueKey]: commentId };
    await writeJsonFile(dismissalsFilePath(), { ...store, [accountId]: next });
    return next;
  });
}

export async function removeDismissal(accountId: string, issueKey: string): Promise<Dismissals> {
  return serialize(async () => {
    const store = await readStore();
    const next = { ...(store[accountId] ?? {}) };
    delete next[issueKey];
    await writeJsonFile(dismissalsFilePath(), { ...store, [accountId]: next });
    return next;
  });
}

export async function clearDismissals(accountId: string): Promise<Dismissals> {
  return serialize(async () => {
    const store = await readStore();
    await writeJsonFile(dismissalsFilePath(), { ...store, [accountId]: {} });
    return {};
  });
}

/** Replace one user's dismissals wholesale, used by pruning. */
export async function replaceDismissals(
  accountId: string,
  dismissals: Dismissals,
): Promise<Dismissals> {
  return serialize(async () => {
    const store = await readStore();
    await writeJsonFile(dismissalsFilePath(), { ...store, [accountId]: dismissals });
    return dismissals;
  });
}
