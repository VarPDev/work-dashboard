/**
 * The file plumbing shared by the small pieces of state this app keeps on disk:
 * which mentions you hid, and which rows you have already seen.
 *
 * Reads and writes are serialized through one queue and writes go via a
 * temporary file, so two quick clicks cannot lose one another and an interrupted
 * write cannot leave half a file behind.
 */

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

/** Everything lands in ./data unless an env var points somewhere else. */
export function dataFilePath(override: string | undefined, fileName: string): string {
  return override ?? path.join(process.cwd(), 'data', fileName);
}

export async function readJsonFile<T>(
  file: string,
  validate: (raw: unknown) => T,
  fallback: T,
  label: string,
): Promise<T> {
  try {
    // turbopackIgnore keeps the bundler from tracing the whole project as an
    // asset because this path is only known at runtime: it is a local data file,
    // not something to be bundled.
    const raw = await readFile(/*turbopackIgnore: true*/ file, 'utf8');
    return validate(JSON.parse(raw));
  } catch (error) {
    // A missing file is the normal first run. Anything unparseable is treated as
    // empty rather than breaking the dashboard over bookkeeping.
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return fallback;
    console.warn(`[${label}] ignoring unreadable store: ${String(error)}`);
    return fallback;
  }
}

export async function writeJsonFile(file: string, data: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });

  const temporary = `${file}.tmp`;
  await writeFile(/*turbopackIgnore: true*/ temporary, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  await rename(temporary, file);
}

let queue: Promise<unknown> = Promise.resolve();

/** Run file work one operation at a time, across every store. */
export function serialize<T>(operation: () => Promise<T>): Promise<T> {
  const result = queue.then(operation, operation);
  queue = result.catch(() => undefined);
  return result;
}
