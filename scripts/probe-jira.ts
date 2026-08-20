/**
 * Standalone Jira access probe (Phase 0).
 *
 * Run with: pnpm probe
 *
 * Reads .env.local directly and talks to Jira with plain fetch. It imports
 * nothing from the app, so it stays usable as a diagnostic even if the app
 * code is broken. The token is never printed, only masked.
 */

const ENV_FILE = '.env.local';

function fail(message: string): never {
  console.error(`\n  FATAL: ${message}\n`);
  process.exit(1);
}

try {
  process.loadEnvFile(ENV_FILE);
} catch {
  fail(`Cannot read ${ENV_FILE}. Copy .env.example to .env.local and fill it in.`);
}

/** Accept both "example.atlassian.net" and "https://example.atlassian.net/". */
function normalizeBaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

const baseUrl = normalizeBaseUrl(process.env.JIRA_BASE_URL ?? '');
const email = process.env.JIRA_EMAIL ?? '';
const token = process.env.JIRA_API_TOKEN ?? '';
const authMode = (process.env.JIRA_AUTH_MODE ?? 'basic').toLowerCase();

for (const [key, value] of Object.entries({
  JIRA_BASE_URL: baseUrl,
  JIRA_EMAIL: email,
  JIRA_API_TOKEN: token,
})) {
  if (!value) fail(`${key} is empty in ${ENV_FILE}.`);
}
if (authMode !== 'basic' && authMode !== 'bearer') {
  fail(`JIRA_AUTH_MODE must be "basic" or "bearer", got "${authMode}".`);
}

const authHeader =
  authMode === 'basic'
    ? `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`
    : `Bearer ${token}`;

function mask(secret: string): string {
  if (secret.length <= 8) return '*'.repeat(secret.length);
  return `${secret.slice(0, 4)}...${secret.slice(-4)} (${secret.length} chars)`;
}

/** Quote a value for safe interpolation into a JQL string literal. */
function jqlString(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

type ProbeResponse = {
  status: number;
  ok: boolean;
  // Response shapes are what this probe is discovering; the typed client lands in Phase 1.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any;
  text: string;
};

let httpCalls = 0;

async function jira(path: string, init?: RequestInit): Promise<ProbeResponse> {
  httpCalls += 1;
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: authHeader,
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(30_000),
  });
  const text = await res.text();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  return { status: res.status, ok: res.ok, body, text };
}

function errorOf(res: ProbeResponse): string {
  const messages: string[] = [
    ...(Array.isArray(res.body?.errorMessages) ? res.body.errorMessages : []),
    ...(res.body?.errors ? Object.values(res.body.errors).map(String) : []),
  ];
  if (messages.length) return messages.join(' | ');
  if (res.body?.message) return String(res.body.message);
  return res.text.replace(/\s+/g, ' ').slice(0, 180) || '(empty body)';
}

function section(title: string): void {
  console.log(`\n${'='.repeat(74)}\n${title}\n${'='.repeat(74)}`);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function describeSearchShape(body: any): string {
  if (body == null) return 'no body';
  if (typeof body.count === 'number') return `count=${body.count}`;
  const keys = Object.keys(body).filter((key) => key !== 'issues');
  return `issues=${body.issues?.length ?? 0}, other keys: ${keys.join(', ') || '(none)'}`;
}

async function main(): Promise<void> {
  console.log('\nJira probe');
  console.log(`  base URL   : ${baseUrl}`);
  console.log(`  email      : ${email}`);
  console.log(`  auth mode  : ${authMode}`);
  console.log(`  token      : ${mask(token)}`);

  // ----------------------------------------------------------------- /myself
  section('1. Identity - GET /rest/api/3/myself');

  const myself = await jira('/rest/api/3/myself');
  if (!myself.ok) {
    console.log(`  ${authMode} auth failed (${myself.status}): ${errorOf(myself)}`);
    // Data Center fallback, purely so the probe can tell us what kind of instance this is.
    const dc = await jira('/rest/api/2/myself');
    if (dc.ok) {
      console.log('  /rest/api/2/myself answered 200 -> this looks like Jira Data Center/Server.');
      console.log(`  identity: ${dc.body?.accountId ?? dc.body?.name} - ${dc.body?.displayName}`);
      fail('Instance is not Jira Cloud API v3. Stop and report this before Phase 1.');
    }
    fail(`Authentication failed: ${myself.status} - ${errorOf(myself)}`);
  }

  const tokenAccountId: string = myself.body.accountId;

  console.log(`  accountId   : ${tokenAccountId}`);
  console.log(`  displayName : ${myself.body.displayName}`);
  console.log(`  accountType : ${myself.body.accountType}`);
  console.log(`  email       : ${myself.body.emailAddress ?? '(hidden - GDPR strict mode)'}`);
  console.log(`  timeZone    : ${myself.body.timeZone}`);

  // The token identity is not necessarily the person we want to inspect, so the
  // JQL matrix can be pointed at someone else: pnpm probe <lookup> <accountId>
  const overrideAccountId = process.argv[3];
  let accountId = tokenAccountId;
  let displayName: string = myself.body.displayName;

  if (overrideAccountId) {
    const target = await jira(`/rest/api/3/user?accountId=${encodeURIComponent(overrideAccountId)}`);
    if (!target.ok) fail(`Cannot resolve accountId ${overrideAccountId}: ${errorOf(target)}`);
    accountId = target.body.accountId;
    displayName = target.body.displayName;
    console.log(`\n  matrix runs as : ${displayName} (${accountId})`);
  }

  // --------------------------------------------------------- search endpoints
  section('2. Which search endpoint is active?');

  // This instance rejects unbounded JQL on /search/jql, so the detection probe
  // itself has to be bounded. Reuse the query source A will run for real.
  const sampleJql = `assignee = ${jqlString(accountId)} AND statusCategory != Done`;
  const endpoints = [
    {
      key: 'postJql',
      label: 'POST /rest/api/3/search/jql',
      run: () =>
        jira('/rest/api/3/search/jql', {
          method: 'POST',
          body: JSON.stringify({ jql: sampleJql, maxResults: 1, fields: ['summary'] }),
        }),
    },
    {
      key: 'getJql',
      label: 'GET  /rest/api/3/search/jql',
      run: () =>
        jira(
          `/rest/api/3/search/jql?jql=${encodeURIComponent(sampleJql)}&maxResults=1&fields=summary`,
        ),
    },
    {
      key: 'legacy',
      label: 'GET  /rest/api/3/search  (legacy startAt/maxResults)',
      run: () =>
        jira(`/rest/api/3/search?jql=${encodeURIComponent(sampleJql)}&maxResults=1&fields=summary`),
    },
    {
      key: 'approximateCount',
      label: 'POST /rest/api/3/search/approximate-count',
      run: () =>
        jira('/rest/api/3/search/approximate-count', {
          method: 'POST',
          body: JSON.stringify({ jql: sampleJql }),
        }),
    },
  ] as const;

  const support: Record<string, boolean> = {};
  const exists: Record<string, boolean> = {};
  for (const endpoint of endpoints) {
    const res = await endpoint.run();
    support[endpoint.key] = res.ok;
    // 404/410 means the endpoint is gone; anything else means it is there but
    // did not like this particular query.
    exists[endpoint.key] = res.status !== 404 && res.status !== 410;
    console.log(`  [${res.ok ? ' OK ' : String(res.status).padStart(4)}] ${endpoint.label}`);
    console.log(`         ${res.ok ? describeSearchShape(res.body) : errorOf(res)}`);
  }

  const canPostJql = support.postJql;
  const canGetJql = support.getJql;
  const canLegacy = support.legacy;
  const canApproximateCount = support.approximateCount;

  if (!exists.postJql && !exists.getJql && !exists.legacy) {
    fail('No search endpoint is available at all. Stop here and report this.');
  }
  if (!canPostJql && !canGetJql && !canLegacy) {
    console.log('\n  WARNING: every search endpoint exists but rejected the bounded sample query.');
    console.log('  The JQL matrix below still runs, so its errors tell us what this instance wants.');
  }

  async function countIssues(
    jql: string,
  ): Promise<{ ok: boolean; status: number; count: string; error: string }> {
    if (canApproximateCount) {
      const res = await jira('/rest/api/3/search/approximate-count', {
        method: 'POST',
        body: JSON.stringify({ jql }),
      });
      return { ok: res.ok, status: res.status, count: `~${res.body?.count}`, error: errorOf(res) };
    }
    if (canLegacy) {
      const res = await jira(
        `/rest/api/3/search?jql=${encodeURIComponent(jql)}&maxResults=0&fields=summary`,
      );
      return { ok: res.ok, status: res.status, count: String(res.body?.total), error: errorOf(res) };
    }
    const res = await jira('/rest/api/3/search/jql', {
      method: 'POST',
      body: JSON.stringify({ jql, maxResults: 100, fields: ['summary'] }),
    });
    const found = res.body?.issues?.length ?? 0;
    return {
      ok: res.ok,
      status: res.status,
      count: res.body?.isLast === false ? `>=${found}` : String(found),
      error: errorOf(res),
    };
  }

  // -------------------------------------------------------------- JQL matrix
  section('3. Which JQL clauses actually work on this instance?');

  const queries: { label: string; jql: string; note?: string }[] = [
    {
      label: 'assignee = currentUser() AND statusCategory != Done',
      jql: 'assignee = currentUser() AND statusCategory != Done',
      note: 'baseline from the brief; currentUser() is NOT used by the app itself',
    },
    {
      label: 'assignee = "<accountId>" AND statusCategory != Done',
      jql: `assignee = ${jqlString(accountId)} AND statusCategory != Done`,
      note: 'source A depends on this one - it must work',
    },
    {
      label: 'comment ~ currentUser()',
      jql: 'comment ~ currentUser()',
    },
    {
      label: 'comment ~ "<accountId>"',
      jql: `comment ~ ${jqlString(accountId)}`,
      note: 'key discriminant for source B',
    },
    {
      label: 'text ~ "<accountId>"',
      jql: `text ~ ${jqlString(accountId)}`,
    },
    {
      label: 'updated >= -30d AND comment ~ "<displayName>"',
      jql: `updated >= -30d AND comment ~ ${jqlString(displayName)}`,
      note: 'displayName match - noisy, fallback of last resort',
    },
    {
      label: 'updated >= -30d AND assignee != "<accountId>" AND comment ~ "<accountId>"',
      jql: `updated >= -30d AND assignee != ${jqlString(accountId)} AND comment ~ ${jqlString(accountId)}`,
      note: 'the intended candidate query for source B',
    },
    {
      label: 'updated >= -30d AND assignee != "<accountId>" AND watcher = "<accountId>"',
      jql: `updated >= -30d AND assignee != ${jqlString(accountId)} AND watcher = ${jqlString(accountId)}`,
      note: 'watcher fallback',
    },
  ];

  for (const query of queries) {
    const result = await countIssues(query.jql);
    console.log(`  [${result.ok ? ' OK ' : String(result.status).padStart(4)}] ${query.label}`);
    if (query.note) console.log(`         note  : ${query.note}`);
    console.log(`         ${result.ok ? `count : ${result.count}` : `error : ${result.error}`}`);
  }

  // -------------------------------------------------------------- priorities
  section('4. Priorities - GET /rest/api/3/priority (in the order Jira returns them)');

  const priorities = await jira('/rest/api/3/priority');
  if (priorities.ok && Array.isArray(priorities.body)) {
    priorities.body.forEach((priority: { id: string; name: string }, index: number) => {
      console.log(`  ${String(index).padStart(2)}. id=${priority.id.padEnd(6)} ${priority.name}`);
    });
  } else {
    console.log(`  [${priorities.status}] ${errorOf(priorities)}`);
  }

  // ------------------------------------------------------------------ boards
  section('5. Boards - GET /rest/agile/1.0/board (cost check for Phase 4)');

  const boards = await jira('/rest/agile/1.0/board?maxResults=50');
  if (boards.ok) {
    console.log(`  visible boards (total): ${boards.body?.total ?? '(not reported)'}`);
    console.log(`  isLast on first page  : ${boards.body?.isLast}`);
    const values = boards.body?.values ?? [];
    for (const board of values.slice(0, 15)) {
      const project = board.location?.projectKey ? `  [${board.location.projectKey}]` : '';
      console.log(
        `    id=${String(board.id).padEnd(5)} type=${String(board.type).padEnd(6)} ${board.name}${project}`,
      );
    }
    if (values.length > 15) console.log(`    ... and ${values.length - 15} more on this page`);
  } else {
    console.log(`  [${boards.status}] ${errorOf(boards)}`);
  }

  // ------------------------------------------------------------- user picker
  section('6. User picker source - is the global "Browse users" permission granted?');

  const userSearch = await jira('/rest/api/3/user/search?query=a&maxResults=2');
  if (userSearch.ok) {
    console.log(
      `  [ OK ] GET /rest/api/3/user/search - returned ${userSearch.body?.length ?? 0} user(s)`,
    );
    for (const user of userSearch.body ?? []) {
      console.log(
        `         ${user.accountId}  ${user.displayName}  (accountType=${user.accountType}, active=${user.active})`,
      );
    }
  } else {
    console.log(`  [${userSearch.status}] GET /rest/api/3/user/search - ${errorOf(userSearch)}`);
    console.log('         -> "Browse users" is missing; the picker needs a different source.');
  }

  // The token may belong to a shared service account, in which case /myself is
  // NOT the person whose workload we want to see by default. Pass a name to
  // look up the real human: pnpm probe -- <query>
  const lookupQuery = process.argv[2];
  if (lookupQuery) {
    const lookup = await jira(
      `/rest/api/3/user/search?query=${encodeURIComponent(lookupQuery)}&maxResults=10`,
    );
    console.log(`\n  lookup "${lookupQuery}":`);
    if (lookup.ok) {
      for (const user of lookup.body ?? []) {
        console.log(
          `         ${user.accountId}  ${user.displayName}  (accountType=${user.accountType}, active=${user.active})`,
        );
      }
      if (!(lookup.body ?? []).length) console.log('         (no match)');
    } else {
      console.log(`         [${lookup.status}] ${errorOf(lookup)}`);
    }
  }

  const bulk = await jira('/rest/api/3/users/search?maxResults=2');
  console.log(
    `  [${bulk.ok ? ' OK ' : String(bulk.status).padStart(4)}] GET /rest/api/3/users/search (bulk list) - ${
      bulk.ok ? `${bulk.body?.length ?? 0} user(s)` : errorOf(bulk)
    }`,
  );

  // ---------------------------------------------------------------- summary
  section('Summary');
  console.log(`  Jira HTTP calls made by this probe: ${httpCalls}`);
  console.log(
    `  search strategy for Phase 1     : ${
      canPostJql
        ? 'POST /rest/api/3/search/jql + nextPageToken'
        : canGetJql
          ? 'GET /rest/api/3/search/jql + nextPageToken'
          : 'legacy GET /rest/api/3/search + startAt'
    }`,
  );
  console.log(
    `  counting strategy               : ${
      canApproximateCount
        ? 'POST /rest/api/3/search/approximate-count'
        : canLegacy
          ? 'legacy "total" field'
          : 'page through and count'
    }`,
  );
  console.log('');
}

main().catch((error: unknown) => {
  fail(error instanceof Error ? `${error.name}: ${error.message}` : String(error));
});
