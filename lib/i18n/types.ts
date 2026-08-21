/**
 * The message contract. Italian is the reference; every other locale must
 * satisfy this type, so a missing translation is a compile error rather than a
 * hole that shows up on screen.
 *
 * Counts are functions rather than templates with a placeholder: plural rules
 * differ per language, and a function is enough without pulling in a library.
 */

export type Messages = {
  locale: {
    /** The language own name, as listed in the picker. */
    label: string;
    /** What the picker itself is called. */
    picker: string;
  };

  title: string;

  filters: {
    all: string;
    assigned: string;
    mentions: string;
    overdue: string;
  };

  totals: {
    assigned: (count: number) => string;
    mentions: (count: number) => string;
    overdue: (count: number) => string;
  };

  header: {
    updatedAt: (time: string) => string;
    jiraCalls: (count: number) => string;
    refresh: string;
    ageNow: string;
  };

  viewing: {
    title: (name: string) => string;
    notYours: string;
    backToMine: string;
  };

  picker: {
    placeholder: string;
    search: string;
    empty: string;
    me: string;
    directoryUnavailable: string;
  };

  list: {
    itemCount: (count: number) => string;
    ofTotal: (total: number) => string;
    loading: string;
    nothingAtAll: string;
    nothingAtAllFor: (name: string) => string;
    noneWithFilters: string;
    widenFilters: string;
  };

  errors: {
    loadFailed: string;
    retry: string;
    byCode: {
      'browse-users-forbidden': string;
      'unknown-user': string;
      'jira-error': string;
      'config-error': string;
    };
  };

  row: {
    mentionBadge: string;
    assignedBadge: string;
    noAssignee: string;
    noPriority: string;
    emptyComment: string;
    goToComment: string;
    boardless: (project: string) => string;
    boardlessTooltip: (project: string) => string;
    hide: string;
    hideFor: (key: string) => string;
    restore: string;
    restoreFor: (key: string) => string;
  };

  boards: {
    label: string;
    clear: string;
  };

  search: {
    placeholder: string;
    label: string;
    clear: string;
    shortcutHint: string;
    noResults: (query: string) => string;
    tryAnother: string;
  };

  updates: {
    /** The badge on a row that changed since the last look. */
    badge: string;
    badgeTooltip: string;
    count: (count: number) => string;
    markSeen: string;
  };

  hidden: {
    count: (count: number) => string;
    show: string;
    conceal: string;
    restoreAll: string;
  };

  diagnostics: {
    mentions: (values: {
      candidates: number;
      answered: number;
      informational: number;
      falsePositives: number;
    }) => string;
    boards: (queried: number, total: number) => string;
    failedBoards: (names: string) => string;
    truncatedThreads: (keys: string) => string;
  };

  theme: {
    system: string;
    light: string;
    dark: string;
    nowDark: string;
    nowLight: string;
  };
};
