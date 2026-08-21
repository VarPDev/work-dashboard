import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { beforeEach, describe, expect, it } from 'vitest';

import { getSeen, replaceSeen } from './seen-store';

const ALICE = '712020:11111111-1111-1111-1111-111111111111';
const BOB = '712020:22222222-2222-2222-2222-222222222222';

beforeEach(async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'seen-'));
  process.env.SEEN_FILE = path.join(directory, 'nested', 'seen.json');
});

describe('the seen store', () => {
  it('starts empty and reads back what was written', async () => {
    expect(await getSeen(ALICE)).toEqual({});

    await replaceSeen(ALICE, { 'ABC-1': 'comment:100' });
    expect(await getSeen(ALICE)).toEqual({ 'ABC-1': 'comment:100' });
  });

  it('replaces rather than merges, so it cannot grow forever', async () => {
    await replaceSeen(ALICE, { 'ABC-1': 'comment:100' });
    await replaceSeen(ALICE, { 'ABC-2': 'updated:2026-08-01T10:00:00.000+0200' });

    expect(await getSeen(ALICE)).toEqual({ 'ABC-2': 'updated:2026-08-01T10:00:00.000+0200' });
  });

  it('keeps users apart, like every other piece of state here', async () => {
    await replaceSeen(ALICE, { 'ABC-1': 'comment:100' });
    expect(await getSeen(BOB)).toEqual({});
  });
});
