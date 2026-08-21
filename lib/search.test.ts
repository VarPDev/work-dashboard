import { describe, expect, it } from 'vitest';

import type { DashboardItem } from './dashboard-types';
import { buildSearchIndex, searchItems } from './search';

function item(
  key: string,
  summary: string,
  options: {
    labels?: string[];
    project?: string;
    board?: string;
    assignee?: string;
    mentionText?: string;
    mentionedBy?: string;
    status?: string;
    issueType?: string;
  } = {},
): DashboardItem {
  const mention =
    options.mentionText || options.mentionedBy
      ? {
          commentId: '1',
          byDisplayName: options.mentionedBy ?? 'Colleague 1',
          byAvatarUrl: null,
          text: options.mentionText ?? '',
          at: '2026-08-01T10:00:00.000+0200',
          commentUrl: 'https://example.invalid/c/1',
        }
      : null;

  return {
    kind: mention ? 'mention' : 'assigned',
    issue: {
      key,
      url: `https://example.invalid/browse/${key}`,
      summary,
      status: { name: options.status ?? 'Open', category: 'new' },
      priority: null,
      duedate: null,
      project: { key: key.split('-')[0], name: options.project ?? 'Alpha Project' },
      issueType: options.issueType ?? 'Story',
      assignee: options.assignee ? { displayName: options.assignee, avatarUrl: null } : null,
      updated: '2026-08-01T10:00:00.000+0200',
      labels: options.labels ?? [],
      parentKey: null,
    },
    board: { id: 'board:1', label: options.board ?? 'Alpha Dev Board', kind: 'board' },
    mention,
    overdue: false,
    dueSoon: false,
  };
}

const items: DashboardItem[] = [
  item('SGA-1604', 'To implement hotspot list'),
  item('SDE-9845', 'Dev: New Identity Provider integration (WEB)', {
    mentionText: 'can you confirm the second point?',
    mentionedBy: 'Colleague 2',
  }),
  item('AGR-392', 'Speck - Maps for producers', { labels: ['Accessibility'], board: 'AGR board' }),
  item('SDE-10607', 'Importing AEM redactional pages for AI Trip Planner', {
    project: 'Beta Project',
    assignee: 'Mario Rossi',
  }),
  item('SGA-1136', 'Investigation: General Sorting logic', { status: 'In Review' }),
  item('DER-362', 'Roadmap review', { issueType: 'Task', board: 'Gamma Project' }),
];

const index = buildSearchIndex(items);
const search = (query: string) => searchItems(index, items, query).map((found) => found.issue.key);

describe('an empty or too short query', () => {
  it('returns everything, in the order it was given', () => {
    expect(search('')).toEqual(items.map((found) => found.issue.key));
    expect(search('   ')).toEqual(items.map((found) => found.issue.key));
    // One character would match almost anything, so it is not a search yet.
    expect(search('s')).toEqual(items.map((found) => found.issue.key));
  });
});

describe('finding by what you remember', () => {
  it('matches a word in the summary', () => {
    expect(search('hotspot')).toEqual(['SGA-1604']);
  });

  it('matches a word in the middle of the summary, not just the start', () => {
    expect(search('Identity')).toContain('SDE-9845');
  });

  it('answers a full issue key with that one row', () => {
    // Not fuzzily: the other keys of the same project are one edit away, and
    // pasting a key means you want that ticket.
    expect(search('SGA-1604')).toEqual(['SGA-1604']);
    expect(search('sga-1604')).toEqual(['SGA-1604']);
  });

  it('falls back to a fuzzy match for a key that is not on screen', () => {
    expect(search('SGA-1605').length).toBeGreaterThan(0);
  });

  it('matches a partial key fuzzily', () => {
    expect(search('1604')).toContain('SGA-1604');
  });

  it('matches a label', () => {
    expect(search('accessibility')).toContain('AGR-392');
  });

  it('matches the project name', () => {
    expect(search('Beta Project')).toContain('SDE-10607');
  });

  it('matches the board name', () => {
    expect(search('AGR board')).toContain('AGR-392');
  });

  it('matches the assignee', () => {
    expect(search('Mario')).toContain('SDE-10607');
  });

  it('matches the text of the comment that mentioned you', () => {
    expect(search('second point')).toContain('SDE-9845');
  });

  it('matches who mentioned you', () => {
    expect(search('Colleague 2')).toContain('SDE-9845');
  });

  it('matches a status and an issue type', () => {
    expect(search('In Review')).toContain('SGA-1136');
    expect(search('Task')).toContain('DER-362');
  });
});

/** The whole reason for a fuzzy index rather than a substring filter. */
describe('surviving typos', () => {
  it('finds a summary word spelled wrong', () => {
    expect(search('hotspt')).toContain('SGA-1604');
    expect(search('sortign')).toContain('SGA-1136');
  });

  it('finds a name spelled wrong', () => {
    expect(search('Maro Rossi')).toContain('SDE-10607');
  });

  it('copes with a missing letter in a longer word', () => {
    expect(search('Investigaton')).toContain('SGA-1136');
  });

  it('ignores case and accents', () => {
    expect(search('SPECK')).toContain('AGR-392');
    expect(search('rôadmap')).toContain('DER-362');
  });
});

describe('when nothing matches', () => {
  it('returns nothing rather than everything', () => {
    expect(search('zzzzqqqq')).toEqual([]);
  });
});

describe('ranking', () => {
  it('puts the better match first', () => {
    const results = search('Sorting logic');
    expect(results[0]).toBe('SGA-1136');
  });

  it('does not mutate the item list', () => {
    const before = items.map((found) => found.issue.key);
    search('hotspot');
    expect(items.map((found) => found.issue.key)).toEqual(before);
  });
});
