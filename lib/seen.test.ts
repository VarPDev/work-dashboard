import { describe, expect, it } from 'vitest';

import type { DashboardItem } from './dashboard-types';
import { acknowledge, countNew, isNew, markerOf, parseSeen } from './seen';

function assigned(key: string, updated = '2026-08-01T10:00:00.000+0200'): DashboardItem {
  return {
    kind: 'assigned',
    issue: {
      key,
      url: `https://example.invalid/browse/${key}`,
      summary: key,
      status: { name: 'Open', category: 'new' },
      priority: null,
      duedate: null,
      project: { key: 'ABC', name: 'Alpha Project' },
      issueType: 'Story',
      assignee: null,
      updated,
      labels: [],
      parentKey: null,
    },
    board: { id: 'board:1', label: 'Alpha Dev Board', kind: 'board' },
    mention: null,
    overdue: false,
    dueSoon: false,
  };
}

function mention(key: string, commentId: string): DashboardItem {
  return {
    ...assigned(key),
    kind: 'mention',
    mention: {
      commentId,
      byDisplayName: 'Colleague 1',
      byAvatarUrl: null,
      text: 'can you look at this?',
      at: '2026-08-01T10:00:00.000+0200',
      commentUrl: `https://example.invalid/browse/${key}?focusedCommentId=${commentId}`,
      informational: false,
    },
  };
}

describe('what identifies a row', () => {
  it('is the comment for a mention, and the update time for assigned work', () => {
    expect(markerOf(mention('ABC-1', '100'))).toBe('comment:100');
    expect(markerOf(assigned('ABC-1', '2026-08-02T09:00:00.000+0200'))).toBe(
      'updated:2026-08-02T09:00:00.000+0200',
    );
  });
});

describe('nothing is new on a first run', () => {
  it('badges nothing when the state has never been acknowledged', () => {
    // Otherwise the very first look would badge the entire list, which says
    // nothing at all.
    expect(isNew(mention('ABC-1', '100'), {})).toBe(false);
    expect(countNew([mention('ABC-1', '100'), assigned('ABC-2')], {})).toBe(0);
  });
});

describe('after a look has been acknowledged', () => {
  const items = [mention('ABC-1', '100'), assigned('ABC-2', '2026-08-01T10:00:00.000+0200')];
  const seen = acknowledge(items);

  it('treats the same rows as not new', () => {
    expect(items.every((item) => !isNew(item, seen))).toBe(true);
    expect(countNew(items, seen)).toBe(0);
  });

  it('treats an issue that was not there as new', () => {
    expect(isNew(assigned('ABC-9'), seen)).toBe(true);
  });

  it('treats a newer comment on a known issue as new', () => {
    // The row was already in the list, but somebody has said something since.
    expect(isNew(mention('ABC-1', '101'), seen)).toBe(true);
  });

  it('treats an edited issue as new', () => {
    expect(isNew(assigned('ABC-2', '2026-08-05T08:00:00.000+0200'), seen)).toBe(true);
  });

  it('counts only what changed', () => {
    const next = [mention('ABC-1', '101'), items[1], assigned('ABC-9')];
    expect(countNew(next, seen)).toBe(2);
  });
});

describe('acknowledging', () => {
  it('keeps only what was on screen, so the store cannot grow forever', () => {
    const seen = acknowledge([mention('ABC-1', '100')]);
    expect(Object.keys(seen)).toEqual(['ABC-1']);

    const later = acknowledge([assigned('ABC-2')]);
    expect(Object.keys(later)).toEqual(['ABC-2']);
  });

  it('is idempotent', () => {
    const items = [mention('ABC-1', '100')];
    expect(acknowledge(items)).toEqual(acknowledge(items));
  });
});

describe('reading stored state', () => {
  it('survives missing and corrupt storage', () => {
    expect(parseSeen(null)).toEqual({});
    expect(parseSeen('nonsense')).toEqual({});
    expect(parseSeen('[1,2]')).toEqual({});
  });

  it('drops entries that are not markers', () => {
    expect(parseSeen('{"ABC-1":"comment:1","ABC-2":7}')).toEqual({ 'ABC-1': 'comment:1' });
  });
});
