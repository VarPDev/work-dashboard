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

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { parseDismissals, type Dismissals } from './dismissals';

type Store = Record<string, Dismissals>;

export function dismissalsFilePath(): string {
  // Overridable so tests do not touch the real file.
  return process.env.DISMISSALS_FILE ?? path.join(process.cwd(), 'data', 'dismissals.json');
}

function parseStore(raw: string): Store {
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};

  const store: Store = {};
  for (const [accountId, value] of Object.entries(parsed)) {
    store[accountId] = parseDismissals(JSON.stringify(value));
  }
  return store;
}

async function readStore(): Promise<Store> {
  try {
    // turbopackIgnore keeps the bundler from tracing the whole project as an
    // asset because this path is only known at runtime: it is a local data file,
    // not something to be bundled.
    return parseStore(await readFile(/*turbopackIgnore: true*/ dismissalsFilePath(), 'utf8'));
  } catch (error) {
    // A missing file is the normal first run. Anything unparseable is treated as
    // empty rather than breaking the dashboard over hidden-row bookkeeping.
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {};
    console.warn(`[dismissals] ignoring unreadable store: ${String(error)}`);
    return {};
  }
}

async function writeStore(store: Store): Promise<void> {
  const file = dismissalsFilePath();
  await mkdir(path.dirname(file), { recursive: true });

  // Write beside the target and rename, so an interrupted write cannot leave a
  // half-written file behind.
  const temporary = `${file}.tmp`;
  await writeFile(temporary, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
  await rename(temporary, file);
}

/**
 * Reads and writes are serialized through this chain: two clicks in a row must
 * not race and lose one of the two.
 */
let queue: Promise<unknown> = Promise.resolve();

function serialize<T>(operation: () => Promise<T>): Promise<T> {
  const result = queue.then(operation, operation);
  queue = result.catch(() => undefined);
  return result;
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
    await writeStore({ ...store, [accountId]: next });
    return next;
  });
}

export async function removeDismissal(accountId: string, issueKey: string): Promise<Dismissals> {
  return serialize(async () => {
    const store = await readStore();
    const next = { ...(store[accountId] ?? {}) };
    delete next[issueKey];
    await writeStore({ ...store, [accountId]: next });
    return next;
  });
}

export async function clearDismissals(accountId: string): Promise<Dismissals> {
  return serialize(async () => {
    const store = await readStore();
    await writeStore({ ...store, [accountId]: {} });
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
    await writeStore({ ...store, [accountId]: dismissals });
    return dismissals;
  });
}
