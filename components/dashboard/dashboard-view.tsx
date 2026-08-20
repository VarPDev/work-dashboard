'use client';

import {
  AlertTriangle,
  ArrowLeft,
  AtSign,
  CalendarX2,
  EyeOff,
  Inbox,
  RefreshCw,
  Undo2,
  UserCheck,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { BoardFilter } from '@/components/dashboard/board-filter';
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';
import { TaskRow } from '@/components/dashboard/task-row';
import { useDismissals } from '@/components/dashboard/use-dismissals';
import { ThemeToggle } from '@/components/dashboard/theme-toggle';
import { UserPicker } from '@/components/dashboard/user-picker';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { TooltipProvider } from '@/components/ui/tooltip';
import type {
  ApiError,
  DashboardItem,
  DashboardPayload,
  SelectableUser,
  UsersResponse,
} from '@/lib/dashboard-types';
import { isDismissed } from '@/lib/dismissals';
import { formatAge, formatClockTime, plural } from '@/lib/format';
import { boardFacets } from '@/lib/grouping';
import { cn } from '@/lib/utils';

type Filter = 'all' | 'assigned' | 'mentions' | 'overdue';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Tutte' },
  { id: 'assigned', label: 'Assegnate' },
  { id: 'mentions', label: 'Menzioni' },
  { id: 'overdue', label: 'Scadute' },
];

/** Past this age the label turns amber, as a nudge to press Aggiorna. */
const STALE_AFTER_MINUTES = 15;

function matchesFilter(item: DashboardItem, filter: Filter): boolean {
  switch (filter) {
    case 'assigned':
      return item.kind === 'assigned';
    case 'mentions':
      return item.kind === 'mention';
    case 'overdue':
      return item.overdue;
    default:
      return true;
  }
}

async function readJson<T>(response: Response): Promise<T | ApiError> {
  return (await response.json()) as T | ApiError;
}

function isApiError(value: unknown): value is ApiError {
  return typeof value === 'object' && value !== null && 'error' in value;
}

export function DashboardView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedUser = searchParams.get('user');

  const [directory, setDirectory] = useState<UsersResponse | null>(null);
  const [directoryError, setDirectoryError] = useState<string | null>(null);

  /**
   * The result is stored together with the user it was fetched for. Anything
   * that does not match the user currently in the URL is treated as "still
   * loading" — so the previous person's tasks can never sit on screen under the
   * new person's name.
   */
  const [result, setResult] = useState<{
    requested: string | null;
    payload?: DashboardPayload;
    error?: string;
  } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [filter, setFilter] = useState<Filter>('all');
  const [boardFilter, setBoardFilter] = useState<Set<string>>(new Set());
  const [showHidden, setShowHidden] = useState(false);

  // Ticks so the "how old is this" label keeps telling the truth on a tab left
  // open. Nothing is fetched here.
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  // The user directory changes rarely, so it is fetched once per page load.
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch('/api/users');
        const body = await readJson<UsersResponse>(response);
        if (cancelled) return;

        if (isApiError(body)) setDirectoryError(body.error.message);
        else setDirectory(body);
      } catch (error) {
        if (!cancelled) setDirectoryError(error instanceof Error ? error.message : String(error));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const loadTasks = useCallback(
    async (options: { refresh?: boolean; isCancelled?: () => boolean } = {}): Promise<DashboardPayload | null> => {
      const params = new URLSearchParams();
      if (requestedUser) params.set('user', requestedUser);
      if (options.refresh) params.set('refresh', '1');

      try {
        const response = await fetch(`/api/tasks?${params.toString()}`);
        const body = await readJson<DashboardPayload>(response);
        if (options.isCancelled?.()) return null;

        if (isApiError(body)) {
          setResult({ requested: requestedUser, error: body.error.message });
          return null;
        }

        setResult({ requested: requestedUser, payload: body });
        return body;
      } catch (error) {
        if (options.isCancelled?.()) return null;
        setResult({
          requested: requestedUser,
          error: error instanceof Error ? error.message : String(error),
        });
        return null;
      }
    },
    [requestedUser],
  );

  useEffect(() => {
    let cancelled = false;

    // Nothing is set synchronously here: state moves only once the response is
    // in. Until then `result` does not match the requested user, so the skeleton
    // shows instead of the previous person's tasks.
    void (async () => {
      await loadTasks({ isCancelled: () => cancelled });
    })();

    return () => {
      cancelled = true;
    };
  }, [loadTasks]);

  const matchesRequest =
    result !== null &&
    (requestedUser === null ? result.requested === null : result.requested === requestedUser);

  const payload = matchesRequest ? (result?.payload ?? null) : null;
  const taskError = matchesRequest ? (result?.error ?? null) : null;
  const loading = !matchesRequest;

  // Keyed on the user actually loaded, never on the raw URL parameter, so rows
  // can only ever be hidden for the person whose data is on screen.
  const { dismissals, dismiss, restore, restoreAll, prune } = useDismissals(
    payload?.user.accountId ?? null,
  );

  const refresh = async () => {
    setRefreshing(true);
    try {
      const fresh = await loadTasks({ refresh: true });
      // Good moment to forget dismissals a newer comment has already
      // invalidated: we have fresh items, and this is a click, not a render.
      if (fresh) prune(fresh.items);
    } finally {
      setRefreshing(false);
    }
  };

  const selectUser = (accountId: string) => {
    // The selected user lives in the URL, so the link is shareable and the
    // browser back button works.
    const isDefault = accountId === directory?.defaultAccountId;
    router.push(isDefault ? '/' : `/?user=${encodeURIComponent(accountId)}`);
  };

  /**
   * Dismissed rows are excluded from the list, the totals and the board counts:
   * a header saying "24 menzioni" while three of them are hidden would be a lie.
   */
  const kept = useMemo(
    () => (payload ? payload.items.filter((item) => !isDismissed(item, dismissals)) : []),
    [payload, dismissals],
  );

  const totals = useMemo(
    () => ({
      assigned: kept.filter((item) => item.kind === 'assigned').length,
      mentions: kept.filter((item) => item.kind === 'mention').length,
      overdue: kept.filter((item) => item.overdue).length,
    }),
    [kept],
  );

  const boards = useMemo(() => boardFacets(kept), [kept]);

  const passesFilters = useCallback(
    (item: DashboardItem) =>
      matchesFilter(item, filter) && (boardFilter.size === 0 || boardFilter.has(item.board.id)),
    [filter, boardFilter],
  );

  const visibleItems = useMemo(() => kept.filter(passesFilters), [kept, passesFilters]);

  /** Hidden rows that would otherwise be on screen, for the "mostra" toggle. */
  const hiddenItems = useMemo(
    () =>
      payload
        ? payload.items.filter((item) => isDismissed(item, dismissals) && passesFilters(item))
        : [],
    [payload, dismissals, passesFilters],
  );

  const selectedUser: SelectableUser | null =
    payload?.user ??
    directory?.users.find(
      (user) => user.accountId === (requestedUser ?? directory.defaultAccountId),
    ) ??
    null;

  const viewingSomeoneElse = payload ? !payload.isDefaultUser : false;
  const ageMinutes = payload
    ? Math.floor((now.getTime() - new Date(payload.generatedAt).getTime()) / 60_000)
    : 0;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 p-4">
        <header className="flex flex-wrap items-center gap-3">
          <h1 className="text-base font-semibold tracking-tight">Cosa devo fare adesso</h1>

          <UserPicker
            users={directory?.users ?? []}
            selected={selectedUser}
            defaultAccountId={directory?.defaultAccountId ?? null}
            disabled={!directory}
            onSelect={selectUser}
          />

          {payload ? (
            <div className="flex items-center gap-2 text-xs">
              <Badge variant="secondary" className="h-6 gap-1 px-2">
                <Inbox className="size-3" />
                {plural(totals.assigned, 'assegnata', 'assegnate')}
              </Badge>
              <Badge
                variant="outline"
                className="h-6 gap-1 border-violet-500/40 bg-violet-500/10 px-2 text-violet-700 dark:text-violet-300"
              >
                <AtSign className="size-3" />
                {plural(totals.mentions, 'menzione', 'menzioni')}
              </Badge>
              <Badge
                variant="outline"
                className={cn(
                  'h-6 gap-1 px-2',
                  totals.overdue > 0
                    ? 'border-red-500/40 bg-red-500/15 text-red-700 dark:text-red-300'
                    : 'text-muted-foreground',
                )}
              >
                <CalendarX2 className="size-3" />
                {plural(totals.overdue, 'scaduta', 'scadute')}
              </Badge>
            </div>
          ) : null}

          <div className="ml-auto flex items-center gap-2">
            {payload ? (
              <span className="text-xs text-muted-foreground">
                aggiornato {formatClockTime(payload.generatedAt)}
                <span className="mx-1 opacity-40">·</span>
                {/* The payload is cached for half an hour, so how old it is
                    matters more than when it was taken. */}
                <span className={cn(ageMinutes >= STALE_AFTER_MINUTES && 'text-amber-700 dark:text-amber-300')}>
                  {formatAge(payload.generatedAt, now)}
                </span>
                <span className="mx-1 opacity-40">·</span>
                {plural(payload.diagnostics.jiraCalls, 'chiamata Jira', 'chiamate Jira')}
              </span>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refresh()}
              disabled={loading || refreshing}
            >
              <RefreshCw className={cn('size-3.5', refreshing && 'animate-spin')} />
              Aggiorna
            </Button>
            <ThemeToggle />
          </div>
        </header>

        {viewingSomeoneElse && payload ? (
          <Alert className="border-amber-500/40 bg-amber-500/10">
            <UserCheck className="size-4 text-amber-600 dark:text-amber-300" />
            <AlertTitle className="text-amber-800 dark:text-amber-200">
              Stai vedendo il carico di {payload.user.displayName}
            </AlertTitle>
            <AlertDescription className="flex flex-wrap items-center gap-3 text-amber-800/90 dark:text-amber-200/80">
              Nessuno di questi task è tuo.
              <Button variant="secondary" size="sm" onClick={() => router.push('/')}>
                <ArrowLeft className="size-3.5" />
                Torna ai miei
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        {directoryError ? (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertTitle>Elenco utenti non disponibile</AlertTitle>
            <AlertDescription>{directoryError}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {FILTERS.map((entry) => (
              <Button
                key={entry.id}
                variant={filter === entry.id ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setFilter(entry.id)}
              >
                {entry.label}
              </Button>
            ))}

            {payload ? (
              <>
                <Separator orientation="vertical" className="mx-1 h-5" />
                <span className="text-xs text-muted-foreground">
                  {plural(visibleItems.length, 'elemento', 'elementi')}
                  {visibleItems.length !== kept.length ? ` su ${kept.length}` : ''}
                </span>
              </>
            ) : null}
          </div>

          {payload ? (
            <BoardFilter
              boards={boards}
              selected={boardFilter}
              onToggle={(boardId) =>
                setBoardFilter((current) => {
                  const next = new Set(current);
                  if (next.has(boardId)) next.delete(boardId);
                  else next.add(boardId);
                  return next;
                })
              }
              onClear={() => setBoardFilter(new Set())}
            />
          ) : null}
        </div>

        {taskError ? (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertTitle>Non riesco a caricare le attività</AlertTitle>
            <AlertDescription className="flex flex-wrap items-center gap-3">
              {taskError}
              <Button variant="secondary" size="sm" onClick={() => void loadTasks()}>
                Riprova
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        {loading ? <DashboardSkeleton /> : null}

        {!loading && !taskError && payload && visibleItems.length === 0 ? (
          <div className="rounded-md border border-dashed border-border px-6 py-16 text-center">
            <p className="font-medium">
              {payload.items.length === 0
                ? 'Niente da fare. Davvero niente.'
                : 'Nessun elemento con questi filtri.'}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {payload.items.length === 0
                ? `Nessuna issue assegnata e nessuna menzione in attesa per ${payload.user.displayName}.`
                : 'Allarga il filtro, o togli la selezione delle board.'}
            </p>
          </div>
        ) : null}

        {!loading && !taskError && visibleItems.length > 0 ? (
          <div className="overflow-hidden rounded-md border border-border bg-card">
            {visibleItems.map((item) => (
              <TaskRow key={`${item.kind}:${item.issue.key}`} item={item} onDismiss={dismiss} />
            ))}
          </div>
        ) : null}

        {/* Hidden rows are never silently gone: they are always one click away. */}
        {!loading && !taskError && hiddenItems.length > 0 ? (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <EyeOff className="size-3.5" />
              <span>
                {plural(hiddenItems.length, 'menzione nascosta', 'menzioni nascoste')} fino al
                prossimo commento
              </span>
              <Button variant="ghost" size="sm" onClick={() => setShowHidden((show) => !show)}>
                {showHidden ? 'Nascondi' : 'Mostra'}
              </Button>
              <Button variant="ghost" size="sm" onClick={restoreAll}>
                <Undo2 className="size-3" />
                Ripristina tutte
              </Button>
            </div>

            {showHidden ? (
              <div className="overflow-hidden rounded-md border border-dashed border-border bg-card">
                {hiddenItems.map((item) => (
                  <TaskRow
                    key={`hidden:${item.issue.key}`}
                    item={item}
                    dismissed
                    onRestore={restore}
                  />
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {payload ? <Diagnostics payload={payload} /> : null}
      </div>
    </TooltipProvider>
  );
}

/** Quiet footer: the numbers that explain a surprising screen. */
function Diagnostics({ payload }: { payload: DashboardPayload }) {
  const { diagnostics } = payload;

  return (
    <footer className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
      <span>
        menzioni: {diagnostics.mentionCandidates} candidate, {diagnostics.mentionsAlreadyAnswered}{' '}
        già risposte, {diagnostics.mentionsInformationalOnly} solo per conoscenza,{' '}
        {diagnostics.mentionFalsePositives} falsi positivi
      </span>
      <span>
        board: {diagnostics.boardsQueried}/{diagnostics.boardsTotal} interrogate
      </span>
      {diagnostics.failedBoards.length ? (
        <span className="text-amber-700 dark:text-amber-400">
          board non interrogabili: {diagnostics.failedBoards.join(', ')}
        </span>
      ) : null}
      {diagnostics.truncatedThreads.length ? (
        <span className="text-amber-700 dark:text-amber-400">
          thread troppo lunghi per essere scansionati: {diagnostics.truncatedThreads.join(', ')}
        </span>
      ) : null}
    </footer>
  );
}
