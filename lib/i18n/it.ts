import type { Messages } from './types';

export const it: Messages = {
  locale: { label: 'Italiano', picker: 'Lingua' },

  title: 'Cosa devo fare adesso',

  filters: {
    all: 'Tutte',
    assigned: 'Assegnate',
    mentions: 'Menzioni',
    overdue: 'Scadute',
    new: 'Novità',
  },

  totals: {
    assigned: (count) => `${count} ${count === 1 ? 'assegnata' : 'assegnate'}`,
    mentions: (count) => `${count} ${count === 1 ? 'menzione' : 'menzioni'}`,
    overdue: (count) => `${count} ${count === 1 ? 'scaduta' : 'scadute'}`,
  },

  header: {
    updatedAt: (time) => `aggiornato ${time}`,
    jiraCalls: (count) => `${count} ${count === 1 ? 'chiamata Jira' : 'chiamate Jira'}`,
    refresh: 'Aggiorna',
    ageNow: 'adesso',
  },

  viewing: {
    title: (name) => `Stai vedendo il carico di ${name}`,
    notYours: 'Nessuno di questi task è tuo.',
    backToMine: 'Torna ai miei',
  },

  picker: {
    placeholder: 'Scegli un utente',
    search: 'Cerca una persona…',
    empty: 'Nessun utente trovato.',
    me: 'io',
    directoryUnavailable: 'Elenco utenti non disponibile',
    restrictedTitle: 'Solo il tuo carico di lavoro',
    restrictedBody:
      'Al token manca il permesso globale “Browse users”, quindi non può vedere gli altri utenti: il selettore mostra solo l’account configurato.',
  },

  list: {
    itemCount: (count) => `${count} ${count === 1 ? 'elemento' : 'elementi'}`,
    ofTotal: (total) => ` su ${total}`,
    loading: 'Caricamento attività',
    nothingAtAll: 'Niente da fare. Davvero niente.',
    nothingAtAllFor: (name) =>
      `Nessuna issue assegnata e nessuna menzione in attesa per ${name}.`,
    noneWithFilters: 'Nessun elemento con questi filtri.',
    widenFilters: 'Allarga il filtro, o togli la selezione delle board.',
  },

  errors: {
    loadFailed: 'Non riesco a caricare le attività',
    retry: 'Riprova',
    byCode: {
      'other-users-hidden':
        'Questo token non può vedere gli altri utenti Jira: si può mostrare solo l’account configurato.',
      'unknown-user': 'Nessun utente Jira corrisponde. Scegline uno dalla lista.',
      'jira-error': 'Jira ha risposto con un errore.',
      'config-error': 'Configurazione incompleta: controlla .env.local.',
    },
  },

  row: {
    mentionBadge: 'Menzione senza risposta',
    assignedBadge: 'Assegnata',
    noAssignee: 'Nessun assegnatario',
    noPriority: 'senza priorità',
    emptyComment: '(commento senza testo)',
    goToComment: 'vai al commento',
    fullComment: 'Mostra tutto il commento',
    fullCommentFor: (key) => `Mostra tutto il commento su ${key}`,
    commentOn: (key) => `Commento su ${key}`,
    close: 'Chiudi',
    boardless: (project) => `Senza board — ${project}`,
    boardlessTooltip: (project) =>
      `${project} — questa issue non sta su nessuna board`,
    hide: 'Nascondi fino al prossimo commento',
    hideFor: (key) => `Nascondi ${key}`,
    restore: 'Rimetti in lista',
    restoreFor: (key) => `Ripristina ${key}`,
  },

  boards: {
    label: 'board',
    clear: 'Tutte le board',
  },

  search: {
    placeholder: 'Cerca…',
    label: 'Cerca tra le attività',
    clear: 'Cancella la ricerca',
    shortcutHint: 'premi / per cercare',
    noResults: (query) => `Nessun risultato per “${query}”.`,
    tryAnother: 'La ricerca tollera gli errori di battitura, ma non trova nulla con questo testo.',
  },

  updates: {
    badge: 'nuovo',
    badgeTooltip: 'Comparso o cambiato da quando hai guardato',
    // 'novità' is the same in the singular and the plural.
    count: (count) => `${count} novità`,
    markSeen: 'Segna come viste',
  },

  hidden: {
    count: (count) =>
      `${count} ${count === 1 ? 'menzione nascosta' : 'menzioni nascoste'} fino al prossimo commento`,
    show: 'Mostra',
    conceal: 'Nascondi',
    restoreAll: 'Ripristina tutte',
  },

  diagnostics: {
    mentions: ({ candidates, answered, informational, falsePositives }) =>
      `menzioni: ${candidates} candidate, ${answered} già risposte, ${informational} solo per conoscenza, ${falsePositives} falsi positivi`,
    boards: (queried, total) => `board: ${queried}/${total} interrogate`,
    failedBoards: (names) => `board non interrogabili: ${names}`,
    truncatedThreads: (keys) => `thread troppo lunghi per essere scansionati: ${keys}`,
  },

  theme: {
    system: 'Tema: come il sistema',
    light: 'Tema: chiaro',
    dark: 'Tema: scuro',
    nowDark: 'ora scuro',
    nowLight: 'ora chiaro',
  },
};
