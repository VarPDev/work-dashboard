/** Tunables. Everything here is a deliberate trade-off, not a placeholder. */

/** How far back to look for unanswered mentions. */
export const MENTION_WINDOW_DAYS = 30;

/**
 * Each candidate costs one comments call, so the candidate set is capped.
 * The instance returns ~51 candidates for a busy account over 30 days.
 */
export const MENTION_CANDIDATE_LIMIT = 100;

/** Parallel comment fetches. Higher risks 429s for no real gain. */
export const MENTION_FETCH_CONCURRENCY = 5;

/**
 * Task payload cache.
 *
 * Half an hour, deliberately long: a cold load costs ~64 Jira calls, and
 * reloading the page should not pay that again. Fresh data is what the refresh
 * button is for — it is the only thing that bypasses this.
 */
export const TASKS_CACHE_TTL_MS = 30 * 60 * 1000;

/** The user list barely changes; one Jira call per hour is plenty. */
export const USERS_CACHE_TTL_MS = 60 * 60 * 1000;
