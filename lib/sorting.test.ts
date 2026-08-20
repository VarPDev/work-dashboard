import { describe, expect, it } from 'vitest';

import type { JiraIssue, JiraPriority } from './jira/types';
import { buildPriorityRanks, priorityRank, UNRANKED } from './priority';
import { addDays, compareIssues, isDueSoon, isOverdue, sortItems, today } from './sorting';

/** The real priority scheme of this instance, in the order Jira returns it. */
const JIRA_PRIORITIES: JiraPriority[] = [
  { id: '1', name: 'Highest' },
  { id: '2', name: 'High' },
  { id: '3', name: 'Medium' },
  { id: '4', name: 'Low' },
  { id: '10000', name: 'Very Low' },
  { id: '10001', name: 'Not Clear' },
];

const ranks = buildPriorityRanks(JIRA_PRIORITIES);

function issue(
  key: string,
  options: { priority?: string; duedate?: string | null; updated?: string } = {},
): JiraIssue {
  const priority = options.priority
    ? (JIRA_PRIORITIES.find((p) => p.name === options.priority) ?? null)
    : null;

  return {
    id: key,
    key,
    fields: {
      summary: key,
      status: {
        id: '1',
        name: 'Open',
        statusCategory: { id: 2, key: 'new', name: 'To Do', colorName: 'blue-gray' },
      },
      priority,
      duedate: options.duedate ?? null,
      project: { id: '1', key: 'SGA', name: 'Alpha Project' },
      issuetype: { id: '1', name: 'Story', subtask: false },
      assignee: null,
      updated: options.updated ?? '2026-08-01T10:00:00.000+0200',
      labels: [],
    },
  };
}

describe('priority ranking', () => {
  it('ranks by the order Jira returns, not by name', () => {
    expect(priorityRank(issue('a', { priority: 'Highest' }), ranks)).toBeLessThan(
      priorityRank(issue('b', { priority: 'High' }), ranks),
    );
    // Alphabetically "High" would beat "Highest" and "Low" would beat "Medium".
    expect(priorityRank(issue('a', { priority: 'Medium' }), ranks)).toBeLessThan(
      priorityRank(issue('b', { priority: 'Low' }), ranks),
    );
  });

  it('applies the config override that lifts "Not Clear" above "Low"', () => {
    expect(priorityRank(issue('a', { priority: 'Not Clear' }), ranks)).toBeLessThan(
      priorityRank(issue('b', { priority: 'Low' }), ranks),
    );
    expect(priorityRank(issue('a', { priority: 'Not Clear' }), ranks)).toBeGreaterThan(
      priorityRank(issue('b', { priority: 'Medium' }), ranks),
    );
  });

  it('sorts an issue with no priority last', () => {
    expect(priorityRank(issue('a'), ranks)).toBe(UNRANKED);
    expect(priorityRank(issue('a'), ranks)).toBeGreaterThan(
      priorityRank(issue('b', { priority: 'Very Low' }), ranks),
    );
  });

  it('keeps Jira order for a priority the config does not mention', () => {
    const withExtra = buildPriorityRanks([...JIRA_PRIORITIES, { id: '10002', name: 'Blocker?' }]);
    expect(withExtra.byName.get('Blocker?')).toBeGreaterThan(withExtra.byName.get('Very Low') ?? 0);
  });

  it('ranks an unknown priority id by name as a fallback', () => {
    const renamed = issue('a', { priority: 'High' });
    renamed.fields.priority = { id: '999', name: 'High' };
    expect(priorityRank(renamed, ranks)).toBe(ranks.byName.get('High'));
  });
});

describe('due date helpers', () => {
  it('adds days across a month boundary', () => {
    expect(addDays('2026-08-30', 2)).toBe('2026-09-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('flags an overdue issue and not a future one', () => {
    expect(isOverdue(issue('a', { duedate: '2026-08-19' }), '2026-08-20')).toBe(true);
    expect(isOverdue(issue('a', { duedate: '2026-08-20' }), '2026-08-20')).toBe(false);
    expect(isOverdue(issue('a', { duedate: null }), '2026-08-20')).toBe(false);
  });

  it('flags due today and within two days, but not overdue or later', () => {
    expect(isDueSoon(issue('a', { duedate: '2026-08-20' }), '2026-08-20')).toBe(true);
    expect(isDueSoon(issue('a', { duedate: '2026-08-22' }), '2026-08-20')).toBe(true);
    expect(isDueSoon(issue('a', { duedate: '2026-08-23' }), '2026-08-20')).toBe(false);
    expect(isDueSoon(issue('a', { duedate: '2026-08-19' }), '2026-08-20')).toBe(false);
  });

  it('formats today without shifting the day', () => {
    expect(today(new Date(2026, 7, 20, 23, 30))).toBe('2026-08-20');
    expect(today(new Date(2026, 0, 1, 0, 15))).toBe('2026-01-01');
  });
});

describe('item ordering', () => {
  it('puts higher priority first', () => {
    const items = [
      { issue: issue('low', { priority: 'Low' }) },
      { issue: issue('highest', { priority: 'Highest' }) },
      { issue: issue('medium', { priority: 'Medium' }) },
    ];
    expect(sortItems(items, ranks).map((i) => i.issue.key)).toEqual(['highest', 'medium', 'low']);
  });

  it('breaks a priority tie by due date ascending', () => {
    const items = [
      { issue: issue('later', { priority: 'High', duedate: '2026-09-01' }) },
      { issue: issue('sooner', { priority: 'High', duedate: '2026-08-21' }) },
    ];
    expect(sortItems(items, ranks).map((i) => i.issue.key)).toEqual(['sooner', 'later']);
  });

  it('always puts a missing due date last within the same priority', () => {
    const items = [
      { issue: issue('nodate', { priority: 'High', duedate: null }) },
      { issue: issue('far', { priority: 'High', duedate: '2027-01-01' }) },
    ];
    expect(sortItems(items, ranks).map((i) => i.issue.key)).toEqual(['far', 'nodate']);
    // And the same the other way round, so it is the rule and not the input order.
    expect(sortItems([...items].reverse(), ranks).map((i) => i.issue.key)).toEqual([
      'far',
      'nodate',
    ]);
  });

  it('breaks a full tie by most recently updated', () => {
    const items = [
      {
        issue: issue('stale', {
          priority: 'High',
          duedate: '2026-08-25',
          updated: '2026-08-01T10:00:00.000+0200',
        }),
      },
      {
        issue: issue('fresh', {
          priority: 'High',
          duedate: '2026-08-25',
          updated: '2026-08-19T10:00:00.000+0200',
        }),
      },
    ];
    expect(sortItems(items, ranks).map((i) => i.issue.key)).toEqual(['fresh', 'stale']);
  });

  it('does not mutate the input array', () => {
    const items = [
      { issue: issue('low', { priority: 'Low' }) },
      { issue: issue('highest', { priority: 'Highest' }) },
    ];
    sortItems(items, ranks);
    expect(items.map((i) => i.issue.key)).toEqual(['low', 'highest']);
  });

  it('compares two issues with no priority and no due date consistently', () => {
    const a = issue('a', { updated: '2026-08-02T10:00:00.000+0200' });
    const b = issue('b', { updated: '2026-08-03T10:00:00.000+0200' });
    expect(compareIssues(a, b, ranks)).toBeGreaterThan(0);
    expect(compareIssues(b, a, ranks)).toBeLessThan(0);
  });
});
