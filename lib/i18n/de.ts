import type { Messages } from './types';

export const de: Messages = {
  locale: { label: 'Deutsch', picker: 'Sprache' },

  title: 'Was ist jetzt zu tun',

  filters: {
    all: 'Alle',
    assigned: 'Zugewiesen',
    mentions: 'Erwähnungen',
    overdue: 'Überfällig',
  },

  totals: {
    assigned: (count) => `${count} zugewiesen`,
    mentions: (count) => `${count} ${count === 1 ? 'Erwähnung' : 'Erwähnungen'}`,
    overdue: (count) => `${count} überfällig`,
  },

  header: {
    updatedAt: (time) => `aktualisiert ${time}`,
    jiraCalls: (count) => `${count} Jira-${count === 1 ? 'Aufruf' : 'Aufrufe'}`,
    refresh: 'Aktualisieren',
    ageNow: 'gerade jetzt',
  },

  viewing: {
    title: (name) => `Du siehst die Aufgaben von ${name}`,
    notYours: 'Keine dieser Aufgaben ist deine.',
    backToMine: 'Zurück zu meinen',
  },

  picker: {
    placeholder: 'Person auswählen',
    search: 'Nach einer Person suchen…',
    empty: 'Keine Person gefunden.',
    me: 'ich',
    directoryUnavailable: 'Benutzerliste nicht verfügbar',
  },

  list: {
    itemCount: (count) => `${count} ${count === 1 ? 'Eintrag' : 'Einträge'}`,
    ofTotal: (total) => ` von ${total}`,
    loading: 'Aufgaben werden geladen',
    nothingAtAll: 'Nichts zu tun. Wirklich nichts.',
    nothingAtAllFor: (name) =>
      `Keine zugewiesenen Vorgänge und keine offenen Erwähnungen für ${name}.`,
    noneWithFilters: 'Keine Einträge mit diesen Filtern.',
    widenFilters: 'Filter erweitern oder die Board-Auswahl aufheben.',
  },

  errors: {
    loadFailed: 'Die Aufgaben können nicht geladen werden',
    retry: 'Erneut versuchen',
    byCode: {
      'browse-users-forbidden':
        'Jira hat die Benutzerliste abgelehnt: dem Token fehlt die globale Berechtigung „Browse users“. Die Auswahl kann nicht gefüllt werden.',
      'unknown-user': 'Kein Jira-Benutzer passt dazu. Wähle jemanden aus der Liste.',
      'jira-error': 'Jira hat mit einem Fehler geantwortet.',
      'config-error': 'Unvollständige Konfiguration: prüfe .env.local.',
    },
  },

  row: {
    mentionBadge: 'Unbeantwortete Erwähnung',
    assignedBadge: 'Dieser Person zugewiesen',
    noAssignee: 'Niemand zugewiesen',
    noPriority: 'keine Priorität',
    emptyComment: '(Kommentar ohne Text)',
    goToComment: 'zum Kommentar',
    boardless: (project) => `Kein Board — ${project}`,
    boardlessTooltip: (project) => `${project} — dieser Vorgang liegt auf keinem Board`,
    hide: 'Bis zum nächsten Kommentar ausblenden',
    hideFor: (key) => `${key} ausblenden`,
    restore: 'Wieder in die Liste',
    restoreFor: (key) => `${key} wiederherstellen`,
  },

  boards: {
    label: 'Board',
    clear: 'Alle Boards',
  },

  search: {
    placeholder: 'Suchen…',
    label: 'Aufgaben durchsuchen',
    clear: 'Suche löschen',
    shortcutHint: '/ drücken, um zu suchen',
    noResults: (query) => `Keine Treffer für „${query}“.`,
    tryAnother: 'Die Suche verzeiht Tippfehler, aber dazu passt hier nichts.',
  },

  hidden: {
    count: (count) =>
      `${count} ausgeblendete ${count === 1 ? 'Erwähnung' : 'Erwähnungen'} bis zum nächsten Kommentar`,
    show: 'Anzeigen',
    conceal: 'Ausblenden',
    restoreAll: 'Alle wiederherstellen',
  },

  diagnostics: {
    mentions: ({ candidates, answered, informational, falsePositives }) =>
      `Erwähnungen: ${candidates} Kandidaten, ${answered} schon beantwortet, ${informational} nur zur Information, ${falsePositives} Fehltreffer`,
    boards: (queried, total) => `Boards: ${queried}/${total} abgefragt`,
    failedBoards: (names) => `Boards, die die Abfrage abgelehnt haben: ${names}`,
    truncatedThreads: (keys) => `Verläufe zu lang für eine vollständige Prüfung: ${keys}`,
  },

  theme: {
    system: 'Design: wie das System',
    light: 'Design: hell',
    dark: 'Design: dunkel',
    nowDark: 'derzeit dunkel',
    nowLight: 'derzeit hell',
  },
};
