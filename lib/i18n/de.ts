import type { Messages } from './types';

export const de: Messages = {
  locale: { label: 'Deutsch', picker: 'Sprache' },

  title: 'Was ist jetzt zu tun',

  filters: {
    all: 'Alle',
    assigned: 'Zugewiesen',
    mentions: 'Erwähnungen',
    overdue: 'Überfällig',
    new: 'Neu',
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
    restrictedTitle: 'Nur deine eigenen Aufgaben',
    restrictedBody:
      'Dem Token fehlt die globale Berechtigung „Browse users“, es kann die anderen Benutzer also nicht sehen: die Auswahl enthält nur das konfigurierte Konto.',
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
      'other-users-hidden':
        'Dieses Token kann die anderen Jira-Benutzer nicht sehen, es kann nur das konfigurierte Konto angezeigt werden.',
      'unknown-user': 'Kein Jira-Benutzer passt dazu. Wähle jemanden aus der Liste.',
      'jira-error': 'Jira hat mit einem Fehler geantwortet.',
      'config-error': 'Unvollständige Konfiguration: prüfe .env.local.',
    },
  },

  row: {
    mentionBadge: 'Unbeantwortete Erwähnung',
    informationalBadge: 'Nur zur Information (fyi / cc)',
    assignedBadge: 'Dieser Person zugewiesen',
    noAssignee: 'Niemand zugewiesen',
    noPriority: 'keine Priorität',
    emptyComment: '(Kommentar ohne Text)',
    goToComment: 'zum Kommentar',
    fullComment: 'Ganzen Kommentar anzeigen',
    fullCommentFor: (key) => `Ganzen Kommentar zu ${key} anzeigen`,
    commentOn: (key) => `Kommentar zu ${key}`,
    close: 'Schließen',
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

  updates: {
    badge: 'neu',
    badgeTooltip: 'Neu oder geändert seit dem letzten Ansehen',
    count: (count) => `${count} neu`,
    markSeen: 'Als gesehen markieren',
  },

  hidden: {
    count: (count) =>
      `${count} ausgeblendete ${count === 1 ? 'Erwähnung' : 'Erwähnungen'} bis zum nächsten Kommentar`,
    show: 'Anzeigen',
    conceal: 'Ausblenden',
    restoreAll: 'Alle wiederherstellen',
  },

  informational: {
    count: (count) =>
      `${count} ${count === 1 ? 'Erwähnung' : 'Erwähnungen'} nur zur Information (fyi / cc)`,
    show: 'Anzeigen',
    conceal: 'Ausblenden',
    tooltip:
      'Du wurdest über eine „fyi“- oder „cc“-Zeile informiert: nichts zu beantworten, der Kommentar steht aber hier.',
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
