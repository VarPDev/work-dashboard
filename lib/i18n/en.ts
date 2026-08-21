import type { Messages } from './types';

export const en: Messages = {
  locale: { label: 'English', picker: 'Language' },

  title: 'What do I have to do now',

  filters: {
    all: 'All',
    assigned: 'Assigned',
    mentions: 'Mentions',
    overdue: 'Overdue',
    new: 'New',
  },

  totals: {
    assigned: (count) => `${count} assigned`,
    mentions: (count) => `${count} ${count === 1 ? 'mention' : 'mentions'}`,
    overdue: (count) => `${count} overdue`,
  },

  header: {
    updatedAt: (time) => `updated ${time}`,
    jiraCalls: (count) => `${count} Jira ${count === 1 ? 'call' : 'calls'}`,
    refresh: 'Refresh',
    ageNow: 'just now',
  },

  viewing: {
    title: (name) => `You are looking at ${name}’s workload`,
    notYours: 'None of these tasks are yours.',
    backToMine: 'Back to mine',
  },

  picker: {
    placeholder: 'Pick a user',
    search: 'Search for someone…',
    empty: 'No user found.',
    me: 'me',
    directoryUnavailable: 'User directory unavailable',
  },

  list: {
    itemCount: (count) => `${count} ${count === 1 ? 'item' : 'items'}`,
    ofTotal: (total) => ` of ${total}`,
    loading: 'Loading tasks',
    nothingAtAll: 'Nothing to do. Really nothing.',
    nothingAtAllFor: (name) => `No assigned issues and no waiting mentions for ${name}.`,
    noneWithFilters: 'Nothing matches these filters.',
    widenFilters: 'Widen the filter, or clear the selected boards.',
  },

  errors: {
    loadFailed: 'Cannot load the tasks',
    retry: 'Try again',
    byCode: {
      'browse-users-forbidden':
        'Jira refused the user directory: the token is missing the global “Browse users” permission. The picker cannot be filled.',
      'unknown-user': 'No Jira user matches. Pick someone from the list.',
      'jira-error': 'Jira answered with an error.',
      'config-error': 'Incomplete configuration: check .env.local.',
    },
  },

  row: {
    mentionBadge: 'Unanswered mention',
    assignedBadge: 'Assigned to this person',
    noAssignee: 'No assignee',
    noPriority: 'no priority',
    emptyComment: '(comment with no text)',
    goToComment: 'go to comment',
    fullComment: 'Show the whole comment',
    fullCommentFor: (key) => `Show the whole comment on ${key}`,
    commentOn: (key) => `Comment on ${key}`,
    close: 'Close',
    boardless: (project) => `No board — ${project}`,
    boardlessTooltip: (project) => `${project} — this issue is on no board`,
    hide: 'Hide until the next comment',
    hideFor: (key) => `Hide ${key}`,
    restore: 'Put it back in the list',
    restoreFor: (key) => `Restore ${key}`,
  },

  boards: {
    label: 'board',
    clear: 'All boards',
  },

  search: {
    placeholder: 'Search…',
    label: 'Search the tasks',
    clear: 'Clear the search',
    shortcutHint: 'press / to search',
    noResults: (query) => `Nothing matches “${query}”.`,
    tryAnother: 'The search tolerates typos, but nothing here matches this text.',
  },

  updates: {
    badge: 'new',
    badgeTooltip: 'Appeared or changed since you last looked',
    count: (count) => `${count} new`,
    markSeen: 'Mark as seen',
  },

  hidden: {
    count: (count) =>
      `${count} hidden ${count === 1 ? 'mention' : 'mentions'} until the next comment`,
    show: 'Show',
    conceal: 'Hide',
    restoreAll: 'Restore all',
  },

  diagnostics: {
    mentions: ({ candidates, answered, informational, falsePositives }) =>
      `mentions: ${candidates} candidates, ${answered} already answered, ${informational} for information only, ${falsePositives} false positives`,
    boards: (queried, total) => `boards: ${queried}/${total} queried`,
    failedBoards: (names) => `boards that refused the query: ${names}`,
    truncatedThreads: (keys) => `threads too long to scan fully: ${keys}`,
  },

  theme: {
    system: 'Theme: follow the system',
    light: 'Theme: light',
    dark: 'Theme: dark',
    nowDark: 'currently dark',
    nowLight: 'currently light',
  },
};
