/**
 * Thin, typed Jira Cloud client. Server side only — it holds the credentials.
 */

import { AsyncLocalStorage } from 'node:async_hooks';

import { authorizationHeader, getJiraConfig } from './env';
import type { JiraErrorBody } from './types';

const REQUEST_TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 4;
const RETRY_STATUSES = new Set([429, 502, 503, 504]);
/** Never sit on a Retry-After longer than this; better to fail and show it. */
const MAX_RETRY_DELAY_MS = 10_000;

export class JiraApiError extends Error {
  readonly status: number;
  readonly messages: string[];
  readonly path: string;

  constructor(status: number, path: string, messages: string[]) {
    super(`Jira ${status} on ${path}${messages.length ? `: ${messages.join(' | ')}` : ''}`);
    this.name = 'JiraApiError';
    this.status = status;
    this.path = path;
    this.messages = messages;
  }
}

/**
 * Per-request Jira call counter. AsyncLocalStorage rather than a module-level
 * number, so two concurrent dashboard requests do not pollute each other.
 */
const callCounter = new AsyncLocalStorage<{ count: number }>();

export function withJiraCallCounter<T>(fn: () => Promise<T>): Promise<{ result: T; calls: number }> {
  const store = { count: 0 };
  return callCounter.run(store, async () => {
    const result = await fn();
    return { result, calls: store.count };
  });
}

export function jiraCallsSoFar(): number {
  return callCounter.getStore()?.count ?? 0;
}

export type JiraRequestOptions = {
  method?: 'GET' | 'POST';
  /** JSON body, serialized for you. */
  body?: unknown;
  searchParams?: Record<string, string | number | boolean | undefined>;
  signal?: AbortSignal;
};

function buildUrl(path: string, searchParams: JiraRequestOptions['searchParams']): string {
  const { baseUrl } = getJiraConfig();
  const url = new URL(`${baseUrl}${path}`);
  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  return url.toString();
}

function messagesFrom(body: JiraErrorBody | null, fallback: string): string[] {
  const messages = [
    ...(body?.errorMessages ?? []),
    ...Object.values(body?.errors ?? {}),
    ...(body?.message ? [body.message] : []),
  ];
  if (messages.length) return messages;
  const trimmed = fallback.replace(/\s+/g, ' ').trim();
  return trimmed ? [trimmed.slice(0, 200)] : [];
}

/** Retry-After is either a delay in seconds or an HTTP date. */
function retryDelayMs(response: Response, attempt: number): number {
  const header = response.headers.get('retry-after');
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds)) return Math.min(seconds * 1000, MAX_RETRY_DELAY_MS);
    const date = Date.parse(header);
    if (!Number.isNaN(date)) {
      return Math.min(Math.max(date - Date.now(), 0), MAX_RETRY_DELAY_MS);
    }
  }
  const backoff = 300 * 2 ** (attempt - 1);
  const jitter = Math.random() * 200;
  return Math.min(backoff + jitter, MAX_RETRY_DELAY_MS);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Below this share of the bucket left, say something. */
const RATE_LIMIT_WARN_RATIO = 0.2;

/**
 * Jira answers with a token bucket: `x-ratelimit-limit` is its size and
 * `x-ratelimit-remaining` what is left. Worth watching, because this token is a
 * shared service account — other systems draw on the same budget.
 */
function warnIfNearRateLimit(response: Response, path: string): void {
  const limit = Number(response.headers.get('x-ratelimit-limit'));
  const remaining = Number(response.headers.get('x-ratelimit-remaining'));
  if (!Number.isFinite(limit) || !Number.isFinite(remaining) || limit <= 0) return;

  if (remaining / limit < RATE_LIMIT_WARN_RATIO) {
    console.warn(
      `[jira] rate limit budget low: ${remaining}/${limit} left (${path}) — ` +
        `policy: ${response.headers.get('ratelimit-policy') ?? 'unknown'}`,
    );
  }
}

/**
 * One Jira request, with retries on rate limiting and transient upstream
 * failures. Throws JiraApiError on anything else.
 */
export async function jiraRequest<T>(path: string, options: JiraRequestOptions = {}): Promise<T> {
  const config = getJiraConfig();
  const url = buildUrl(path, options.searchParams);
  const { method = 'GET', body, signal } = options;

  let lastError: JiraApiError | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    const abort = signal ? AbortSignal.any([signal, timeout]) : timeout;

    const store = callCounter.getStore();
    if (store) store.count += 1;

    const response = await fetch(url, {
      method,
      headers: {
        Authorization: authorizationHeader(config),
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: abort,
      cache: 'no-store',
    });

    warnIfNearRateLimit(response, path);

    if (response.ok) {
      // 204 and friends have no body to parse.
      const text = await response.text();
      return (text ? JSON.parse(text) : null) as T;
    }

    const text = await response.text();
    let parsed: JiraErrorBody | null = null;
    try {
      parsed = text ? (JSON.parse(text) as JiraErrorBody) : null;
    } catch {
      parsed = null;
    }

    lastError = new JiraApiError(response.status, path, messagesFrom(parsed, text));

    if (!RETRY_STATUSES.has(response.status) || attempt === MAX_ATTEMPTS) {
      throw lastError;
    }

    await sleep(retryDelayMs(response, attempt));
  }

  // Unreachable: the loop either returns or throws.
  throw lastError ?? new JiraApiError(500, path, ['Request failed without a response']);
}
