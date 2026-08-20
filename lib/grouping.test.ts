import { describe, expect, it } from 'vitest';

import { boardFacets, boardOf, issueKeysOf, pickBoard, projectKeysOf } from './grouping';
import type { JiraBoard, JiraIssue } from './jira/types';

function issue(key: string, projectKey: string, projectName = projectKey): JiraIssue {
  return {
    id: key,
    key,
    fields: {
      summary: `summary of ${key}`,
      status: {
        id: '1',
        name: 'Open',
        statusCategory: { id: 2, key: 'new', name: 'To Do', colorName: 'blue-gray' },
      },
      priority: null,
      duedate: null,
      project: { id: '1', key: projectKey, name: projectName },
      issuetype: { id: '1', name: 'Story', subtask: false },
      assignee: null,
      updated: '2026-08-01T10:00:00.000+0200',
      labels: [],
    },
  };
}

function board(id: number, name: string, projectKey?: string): JiraBoard {
  return {
    id,
    name,
    type: 'scrum',
    ...(projectKey ? { location: { projectKey } } : {}),
  };
}

const sgaDev = board(75, 'Alpha Dev Board', 'SGA');
const designCross = board(27, 'Design Cross Board', 'SM');
const sdeDev = board(72, 'Beta Dev Board', 'SDE');
const unlisted = board(500, 'Some Other Board', 'SGA');
const unlistedLowerId = board(400, 'Yet Another Board', 'SM');

/** The priority list is passed in, so these tests do not depend on the config. */
const PRIORITY = ['Alpha Dev Board', 'Beta Dev Board', 'Design Cross Board'];

describe('picking one board for an issue on several', () => {
  it('returns null when the issue is on no board', () => {
    expect(pickBoard([], issue('SGA-1', 'SGA'))).toBeNull();
  });

  it('returns the only board without consulting the config', () => {
    expect(pickBoard([unlisted], issue('SGA-1', 'SGA'))?.id).toBe(unlisted.id);
  });

  it('follows the configured order', () => {
    expect(pickBoard([designCross, sgaDev], issue('SGA-1', 'SGA'), PRIORITY)?.name).toBe(
      'Alpha Dev Board',
    );
    expect(pickBoard([sgaDev, designCross], issue('SGA-1', 'SGA'), PRIORITY)?.name).toBe(
      'Alpha Dev Board',
    );
  });

  it('prefers a board in the issue own project over an unlisted cross board', () => {
    expect(pickBoard([unlistedLowerId, unlisted], issue('SGA-1', 'SGA'))?.name).toBe(
      'Some Other Board',
    );
  });

  it('falls back to the lowest board id, so refreshes agree', () => {
    const a = board(900, 'A', 'SM');
    const b = board(100, 'B', 'SM');
    expect(pickBoard([a, b], issue('SGA-1', 'SGA'))?.id).toBe(100);
    expect(pickBoard([b, a], issue('SGA-1', 'SGA'))?.id).toBe(100);
  });
});

describe('the board shown on a row', () => {
  const mapping = new Map<string, JiraBoard[]>([
    ['SGA-1', [sgaDev]],
    ['SGA-2', [designCross, sgaDev]],
    ['SDE-1', [sdeDev]],
    // DER-1 is on no board at all, as happens for a project without boards.
  ]);

  it('names the board the issue belongs to', () => {
    expect(boardOf(issue('SGA-1', 'SGA'), mapping)).toEqual({
      id: 'board:75',
      label: 'Alpha Dev Board',
      kind: 'board',
    });
  });

  it('resolves a multi-board issue to a single board', () => {
    expect(boardOf(issue('SGA-2', 'SGA'), mapping, PRIORITY).label).toBe('Alpha Dev Board');
  });

  it('falls back to the project and says the issue has no board', () => {
    expect(boardOf(issue('DER-1', 'DER', 'Gamma Project'), mapping)).toEqual({
      id: 'project:DER',
      label: 'Senza board — Gamma Project',
      kind: 'project',
    });
  });

  it('treats an unmapped issue as boardless rather than leaving it blank', () => {
    expect(boardOf(issue('NEW-1', 'NEW', 'New Project'), new Map()).kind).toBe('project');
  });
});

describe('board filter facets', () => {
  const sga = { id: 'board:75', label: 'Alpha Dev Board', kind: 'board' as const };
  const sde = { id: 'board:72', label: 'Beta Dev Board', kind: 'board' as const };
  const orphan = { id: 'project:DER', label: 'Senza board — DER', kind: 'project' as const };

  const items = [
    { board: sga, overdue: false },
    { board: sga, overdue: true },
    { board: sde, overdue: false },
    { board: orphan, overdue: true },
    { board: orphan, overdue: true },
  ];

  it('counts items and overdue items per board', () => {
    const facets = boardFacets(items);
    expect(facets.find((facet) => facet.id === 'board:75')).toMatchObject({
      count: 2,
      overdueCount: 1,
    });
    expect(facets.find((facet) => facet.id === 'project:DER')).toMatchObject({
      count: 2,
      overdueCount: 2,
    });
  });

  it('lists the most overdue board first, then alphabetically', () => {
    expect(boardFacets(items).map((facet) => facet.id)).toEqual([
      'project:DER',
      'board:75',
      'board:72',
    ]);
  });

  it('accounts for every item exactly once', () => {
    const facets = boardFacets(items);
    expect(facets.reduce((sum, facet) => sum + facet.count, 0)).toBe(items.length);
  });

  it('returns nothing for an empty list', () => {
    expect(boardFacets([])).toEqual([]);
  });
});

describe('narrowing the board query', () => {
  const items = [
    { issue: issue('SGA-1', 'SGA') },
    { issue: issue('SGA-2', 'SGA') },
    { issue: issue('SDE-1', 'SDE') },
  ];

  it('lists each project once', () => {
    expect(projectKeysOf(items)).toEqual(['SGA', 'SDE']);
  });

  it('de-duplicates issue keys', () => {
    expect(issueKeysOf([...items, items[0]])).toEqual(['SGA-1', 'SGA-2', 'SDE-1']);
  });
});
