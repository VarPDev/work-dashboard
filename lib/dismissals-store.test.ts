import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearDismissals,
  dismissalsFilePath,
  getDismissals,
  removeDismissal,
  replaceDismissals,
  setDismissal,
} from './dismissals-store';

const ALICE = '712020:11111111-1111-1111-1111-111111111111';
const BOB = '712020:22222222-2222-2222-2222-222222222222';

beforeEach(async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'dismissals-'));
  process.env.DISMISSALS_FILE = path.join(directory, 'nested', 'dismissals.json');
});

describe('persistence', () => {
  it('starts empty when the file does not exist yet', async () => {
    expect(await getDismissals(ALICE)).toEqual({});
  });

  it('writes and reads a dismissal back', async () => {
    await setDismissal(ALICE, 'SGA-1', '100');
    expect(await getDismissals(ALICE)).toEqual({ 'SGA-1': '100' });
  });

  it('creates the directory it needs', async () => {
    await setDismissal(ALICE, 'SGA-1', '100');
    const raw = await readFile(dismissalsFilePath(), 'utf8');
    expect(JSON.parse(raw)).toEqual({ [ALICE]: { 'SGA-1': '100' } });
  });

  it('survives a restart, because the state is on disk and not in memory', async () => {
    await setDismissal(ALICE, 'SGA-1', '100');

    // Re-importing the module with its state dropped is what a restarted server
    // does: nothing may be cached in memory.
    vi.resetModules();
    const reloaded = await import('./dismissals-store');

    expect(await reloaded.getDismissals(ALICE)).toEqual({ 'SGA-1': '100' });
  });

  it('keeps several dismissals for the same user', async () => {
    await setDismissal(ALICE, 'SGA-1', '100');
    await setDismissal(ALICE, 'SGA-2', '200');
    expect(await getDismissals(ALICE)).toEqual({ 'SGA-1': '100', 'SGA-2': '200' });
  });

  it('overwrites the watermark when the same issue is dismissed again', async () => {
    await setDismissal(ALICE, 'SGA-1', '100');
    await setDismissal(ALICE, 'SGA-1', '101');
    expect(await getDismissals(ALICE)).toEqual({ 'SGA-1': '101' });
  });

  it('removes one entry and clears all of them', async () => {
    await setDismissal(ALICE, 'SGA-1', '100');
    await setDismissal(ALICE, 'SGA-2', '200');

    expect(await removeDismissal(ALICE, 'SGA-1')).toEqual({ 'SGA-2': '200' });
    expect(await clearDismissals(ALICE)).toEqual({});
    expect(await getDismissals(ALICE)).toEqual({});
  });

  it('replaces a user set wholesale, for pruning', async () => {
    await setDismissal(ALICE, 'SGA-1', '100');
    await replaceDismissals(ALICE, { 'SGA-9': '900' });
    expect(await getDismissals(ALICE)).toEqual({ 'SGA-9': '900' });
  });
});

/**
 * The same rule as the task cache: what is hidden for one person must never be
 * hidden for another.
 */
describe('per-user isolation', () => {
  it('keeps two users apart', async () => {
    await setDismissal(ALICE, 'SGA-1', '100');
    await setDismissal(BOB, 'SGA-2', '200');

    expect(await getDismissals(ALICE)).toEqual({ 'SGA-1': '100' });
    expect(await getDismissals(BOB)).toEqual({ 'SGA-2': '200' });
  });

  it('does not let clearing one user touch the other', async () => {
    await setDismissal(ALICE, 'SGA-1', '100');
    await setDismissal(BOB, 'SGA-2', '200');

    await clearDismissals(ALICE);
    expect(await getDismissals(BOB)).toEqual({ 'SGA-2': '200' });
  });

  it('does not let the same issue dismissed by one hide it for the other', async () => {
    await setDismissal(ALICE, 'SGA-1', '100');
    expect(await getDismissals(BOB)).toEqual({});
  });
});

async function writeStoreFile(content: string): Promise<void> {
  const file = dismissalsFilePath();
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content, 'utf8');
}

describe('bad state on disk', () => {
  it('treats an unparseable file as empty instead of failing', async () => {
    await writeStoreFile('{ not json');

    expect(await getDismissals(ALICE)).toEqual({});

    // And it recovers by writing valid content on the next change.
    await setDismissal(ALICE, 'SGA-1', '100');
    expect(await getDismissals(ALICE)).toEqual({ 'SGA-1': '100' });
  });

  it('drops entries that are not comment ids', async () => {
    await writeStoreFile(JSON.stringify({ [ALICE]: { 'SGA-1': '100', 'SGA-2': 42 } }));

    expect(await getDismissals(ALICE)).toEqual({ 'SGA-1': '100' });
  });

  it('ignores a file that is valid JSON but the wrong shape', async () => {
    await writeStoreFile('["nope"]');
    expect(await getDismissals(ALICE)).toEqual({});
  });
});

describe('concurrent writes', () => {
  it('loses none of them', async () => {
    await Promise.all([
      setDismissal(ALICE, 'SGA-1', '100'),
      setDismissal(ALICE, 'SGA-2', '200'),
      setDismissal(ALICE, 'SGA-3', '300'),
    ]);

    expect(await getDismissals(ALICE)).toEqual({
      'SGA-1': '100',
      'SGA-2': '200',
      'SGA-3': '300',
    });
  });
});
