'use client';

import { useCallback, useEffect, useState } from 'react';

import type { DashboardItem } from '@/lib/dashboard-types';
import { pruneDismissals, type Dismissals } from '@/lib/dismissals';

/**
 * Dismissals for one target user, stored server-side in data/dismissals.json.
 *
 * State is applied optimistically so a click feels instant, then reconciled
 * with whatever the server wrote back.
 */
export function useDismissals(accountId: string | null) {
  const [dismissals, setDismissals] = useState<Dismissals>({});
  const [loaded, setLoaded] = useState(false);

  const query = accountId ? `?user=${encodeURIComponent(accountId)}` : '';

  // Reload whenever the target user changes; empty until then, so nothing is
  // ever hidden for the wrong person.
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch(`/api/dismissals${query}`);
        const body = (await response.json()) as { dismissals?: Dismissals };
        if (cancelled) return;
        setDismissals(body.dismissals ?? {});
        setLoaded(true);
      } catch {
        if (!cancelled) setLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [query]);

  const send = useCallback(
    async (body: unknown, optimistic: Dismissals) => {
      setDismissals(optimistic);
      try {
        const response = await fetch(`/api/dismissals${query}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const result = (await response.json()) as { dismissals?: Dismissals };
        if (result.dismissals) setDismissals(result.dismissals);
      } catch {
        // The optimistic state stands; the next load will correct it.
      }
    },
    [query],
  );

  const dismiss = useCallback(
    (item: DashboardItem) => {
      if (item.kind !== 'mention' || !item.mention) return;
      void send(
        { action: 'dismiss', issueKey: item.issue.key, commentId: item.mention.commentId },
        { ...dismissals, [item.issue.key]: item.mention.commentId },
      );
    },
    [dismissals, send],
  );

  const restore = useCallback(
    (issueKey: string) => {
      const optimistic = { ...dismissals };
      delete optimistic[issueKey];
      void send({ action: 'restore', issueKey }, optimistic);
    },
    [dismissals, send],
  );

  const restoreAll = useCallback(() => {
    void send({ action: 'restore-all' }, {});
  }, [send]);

  /** Forget dismissals that a newer comment has already invalidated. */
  const prune = useCallback(
    (items: readonly DashboardItem[]) => {
      const next = pruneDismissals(items, dismissals);
      if (Object.keys(next).length === Object.keys(dismissals).length) return;
      void send({ action: 'prune', dismissals: next }, next);
    },
    [dismissals, send],
  );

  return { dismissals, loaded, dismiss, restore, restoreAll, prune };
}
