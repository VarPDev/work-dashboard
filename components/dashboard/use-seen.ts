'use client';

import { useCallback, useEffect, useState } from 'react';

import type { DashboardItem } from '@/lib/dashboard-types';
import { acknowledge, type SeenState } from '@/lib/seen';

/**
 * What has already been looked at, for one target user, persisted server-side.
 *
 * Acknowledging is deliberately explicit — on refresh, or on "mark as seen".
 * Doing it on render would mean nothing was ever new.
 */
export function useSeen(accountId: string | null) {
  /** Stored with the user it belongs to, so it cannot leak across a switch. */
  const [state, setState] = useState<{ query: string; seen: SeenState } | null>(null);

  const query = accountId ? `?user=${encodeURIComponent(accountId)}` : '';

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch(`/api/seen${query}`);
        const body = (await response.json()) as { seen?: SeenState };
        if (cancelled) return;
        setState({ query, seen: body.seen ?? {} });
      } catch {
        if (!cancelled) setState({ query, seen: {} });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [query]);

  // Until this user's state has arrived, nothing is known to be new — an empty
  // map means "never acknowledged", which badges nothing.
  const seen = state?.query === query ? state.seen : {};

  const markSeen = useCallback(
    async (items: readonly DashboardItem[]) => {
      const next = acknowledge(items);
      setState({ query, seen: next });

      try {
        await fetch(`/api/seen${query}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ seen: next }),
        });
      } catch {
        // The optimistic state stands; the next load corrects it.
      }
    },
    [query],
  );

  return { seen, markSeen };
}
