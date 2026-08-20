import { USERS_CACHE_TTL_MS } from '@/config/app';
import { cached, cacheKeys } from '@/lib/cache';
import { buildPriorityRanks, type PriorityRanks } from '@/lib/priority';

import { jiraRequest } from './client';
import type { JiraPriority } from './types';

/** The instance-wide priority scheme, in Jira's own order. Cached for an hour. */
export async function getPriorities(signal?: AbortSignal): Promise<JiraPriority[]> {
  return cached(cacheKeys.priorities(), USERS_CACHE_TTL_MS, () =>
    jiraRequest<JiraPriority[]>('/rest/api/3/priority', { signal }),
  );
}

export async function getPriorityRanks(signal?: AbortSignal): Promise<PriorityRanks> {
  return buildPriorityRanks(await getPriorities(signal));
}
