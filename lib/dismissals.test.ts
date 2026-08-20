import { describe, expect, it } from 'vitest';

import type { DashboardItem } from './dashboard-types';
import {
  dismiss,
  isDismissable,
  isDismissed,
  parseDismissals,
  pruneDismissals,
  restore,
} from './dismissals';

function mentionItem(key: string, commentId: string): DashboardItem {
  return {
    kind: 'mention',
    issue: {
      key,
      url: `https://example.invalid/browse/${key}`,
      summary: key,
      status: { name: 'Open', category: 'new' },
      priority: null,
      duedate: null,
      project: { key: 'SGA', name: 'Alpha Project' },
      issueType: 'Story',
      assignee: null,
      updated: '2026-08-01T10:00:00.000+0200',
      labels: [],
      parentKey: null,
    },
    board: { id: 'board:75', label: 'SGA Dev Board', kind: 'board' },
    mention: {
      commentId,
      byDisplayName: 'Colleague 1',
      byAvatarUrl: null,
      text: 'fyi',
      at: '2026-08-01T10:00:00.000+0200',
      commentUrl: `https://example.invalid/browse/${key}?focusedCommentId=${commentId}`,
    },
    overdue: false,
    dueSoon: false,
  };
}

function assignedItem(key: string): DashboardItem {
  return { ...mentionItem(key, 'x'), kind: 'assigned', mention: null };
}

describe('what can be dismissed', () => {
  it('allows mentions', () => {
    expect(isDismissable(mentionItem('SGA-1', '100'))).toBe(true);
  });

  it('refuses assigned issues — that is your own work, not a notification', () => {
    expect(isDismissable(assignedItem('SGA-1'))).toBe(false);
    expect(dismiss(assignedItem('SGA-1'), {})).toEqual({});
  });
});

describe('dismiss and restore', () => {
  it('hides the mention it was applied to', () => {
    const item = mentionItem('SGA-1', '100');
    const dismissals = dismiss(item, {});
    expect(isDismissed(item, dismissals)).toBe(true);
  });

  it('leaves other issues alone', () => {
    const dismissals = dismiss(mentionItem('SGA-1', '100'), {});
    expect(isDismissed(mentionItem('SGA-2', '200'), dismissals)).toBe(false);
  });

  it('expires as soon as a newer comment mentions you', () => {
    const dismissals = dismiss(mentionItem('SGA-1', '100'), {});
    // Same issue, but the last mention is now a different comment.
    expect(isDismissed(mentionItem('SGA-1', '101'), dismissals)).toBe(false);
  });

  it('brings a row back on restore', () => {
    const item = mentionItem('SGA-1', '100');
    const dismissals = restore('SGA-1', dismiss(item, {}));
    expect(isDismissed(item, dismissals)).toBe(false);
  });

  it('does nothing when restoring something that was not dismissed', () => {
    const dismissals = { 'SGA-1': '100' };
    expect(restore('SGA-9', dismissals)).toBe(dismissals);
  });

  it('does not mutate the object it is given', () => {
    const before = { 'SGA-1': '100' };
    dismiss(mentionItem('SGA-2', '200'), before);
    restore('SGA-1', before);
    expect(before).toEqual({ 'SGA-1': '100' });
  });
});

describe('reading stored state', () => {
  it('survives missing, empty and corrupt storage', () => {
    expect(parseDismissals(null)).toEqual({});
    expect(parseDismissals('')).toEqual({});
    expect(parseDismissals('not json')).toEqual({});
    expect(parseDismissals('[1,2,3]')).toEqual({});
    expect(parseDismissals('"a string"')).toEqual({});
  });

  it('drops entries that are not comment ids', () => {
    expect(parseDismissals('{"SGA-1":"100","SGA-2":42,"SGA-3":null}')).toEqual({ 'SGA-1': '100' });
  });

  it('reads back what was written', () => {
    const dismissals = dismiss(mentionItem('SGA-1', '100'), {});
    expect(parseDismissals(JSON.stringify(dismissals))).toEqual(dismissals);
  });
});

describe('pruning', () => {
  it('drops a dismissal whose issue now shows a newer mention', () => {
    const stored = { 'SGA-1': '100', 'SGA-2': '200' };
    const onScreen = [mentionItem('SGA-1', '101'), mentionItem('SGA-2', '200')];
    expect(pruneDismissals(onScreen, stored)).toEqual({ 'SGA-2': '200' });
  });

  it('keeps a dismissal for an issue that is simply not on screen', () => {
    // It may have fallen out of the 30-day window with nothing new said on it.
    expect(pruneDismissals([], { 'SGA-1': '100' })).toEqual({ 'SGA-1': '100' });
  });

  it('ignores assigned rows when pruning', () => {
    expect(pruneDismissals([assignedItem('SGA-1')], { 'SGA-1': '100' })).toEqual({
      'SGA-1': '100',
    });
  });
});
