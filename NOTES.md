# Known limits

Measured against a real Jira Cloud instance (a few hundred accounts, 35 boards)
in August 2026. Numbers are for the default user unless stated otherwise, and
they are there to show orders of magnitude, not as guarantees.

## The token is a shared service account

On the instance this was built against, `/rest/api/3/myself` resolves to a shared
integration account, not to a person. Consequences:

- Every query runs with **that account's permissions**. A project it cannot see
  is invisible to the dashboard no matter who is selected. There is no way around
  this without a per-viewer token, which is explicitly out of scope.
- `JIRA_DEFAULT_ACCOUNT_ID` has to be configured, because "me" cannot be derived
  from the token.

## Mentions

- **The window is on `updated`, not on the mention.** A candidate is an issue
  touched in the last 30 days; the mention inside it can be far older. Real
  examples on screen: mentions from 7 and 10 months ago on issues that were
  updated recently. They are genuinely unanswered, but "unanswered since 10
  months" is closer to archaeology than to a to-do.
- **28 of 51 candidates are on closed issues.** Kept deliberately: an unanswered
  question is unanswered even if the ticket got closed. The status badge on each
  row is what tells them apart. Change `mentionCandidatesJql` in
  `lib/jira/jql.ts` if that stops being useful.
- **"fyi" lines are not questions.** A mention whose line contains nothing but a
  marker — `fyi`, `cc`, `per conoscenza` and friends — is being kept in the loop,
  not asked anything, so it is excluded. On the real data this drops 16 of 50
  candidates, taking the list from 41 items to 24.
- **That rule is deliberately narrow.** The marker has to be the whole line,
  mentions aside. `fyi @Alice can you confirm?` still counts as a question,
  because hiding a real request is worse than showing one notification too many.
- **Being talked about is not being asked.** `@Alice I spoke with @Bob and he
  also suggested…` mentions the target in the third person and still shows up.
  Telling that apart from a real request means reading the sentence, not the
  structure, so it is out of scope.
- **24 unanswered mentions is still a real backlog**, not a detection bug: false
  positives measured 0, and the 10 already-answered ones were correctly
  excluded.
- **`comment ~ "<accountId>"` is a text match.** It happens to work on this
  instance because mention accountIds are in the comment index, but it tokenises,
  so a comment merely *containing* the accountId as text (an audit log, say)
  matches too. The ADF check rejects those — there is a unit test for exactly
  this case. A display-name search, for the record, returns 0 here.
- **Long threads are scanned at most 3 pages deep** (300 comments, newest
  first). If the last mention is older than that, the issue is skipped and its
  key is listed in `truncatedThreads` in the footer. Currently never triggered.
- **The candidate set is capped at 100.** Above that the mention list would be
  incomplete without saying so; the cap is logged.
- **Comment visibility restrictions are not handled specially.** A comment the
  service account cannot see does not exist as far as this app is concerned,
  including as a "reply".

## Boards

- **An issue has no board in Jira.** Boards are saved filters, so membership is
  resolved by querying each board — 13 queries for the projects in play, out of
  35 visible boards.
- **Only boards located in the issue set's projects are queried**
  (`RESTRICT_BOARDS_TO_ISSUE_PROJECTS` in `config/boards.ts`). An issue that lives
  *only* on a cross-project board would land in "Senza board". Coverage was
  identical either way when measured (62/65), but this is the trade-off.
- **20 of 65 issues are on more than one board**, so the tie-break in
  `lib/grouping.ts` decides the board column and the filter bucket for roughly a
  third of the rows. It is deterministic
  (config order → own-project board → lowest board id) but it is still a choice,
  not a truth.
- **3 issues had no board** in the measured run, and all three were explained:
  one project has no boards at all, one issue matches no board filter, and one is
  closed.
- **Scrum backlogs are not consulted.** `/board/{id}/backlog` answers
  `400 Backlogs are not supported on this board` for every kanban board here, so
  the endpoint is not used at all. An issue sitting only in a scrum backlog may
  therefore appear as boardless.

## Hidden mentions

- **Hidden rows live in `data/dismissals.json`**, written by the server and
  gitignored. Not a database, not browser storage: it survives a reload, a
  different browser, a cleared cache and a reboot, which localStorage would not
  guarantee. Delete the file to unhide everything.
- **The watermark is the comment id.** Hiding records *which* mention was
  dismissed, so a newer comment mentioning you brings the row back on its own.
  Nothing expires on a timer.
- **Only mentions can be hidden**, never assigned issues — that is your own work,
  not a notification.
- **Totals and board counts are computed after hiding**, so the header cannot say
  24 while three of them are invisible. That means the numbers in the header no
  longer match the diagnostics line in the footer, which reports what Jira
  returned.
- **Expired entries are cleaned up on refresh**, not on load: pruning writes, and
  writing during a render is a bug waiting to happen. Stale entries are harmless
  in the meantime, and the store is capped at 500.
- **Nothing is written back to Jira.** Hiding a row is invisible to your
  colleagues; nobody learns that you decided not to answer.

## What counts as new

- **A row is new when its marker changed**: the id of the comment shown for a
  mention, the issue's `updated` value for assigned work. So a badge appears both
  for a row that was not there and for one where somebody has since said
  something — which is the part worth noticing.
- **Acknowledging is explicit**, never on render: pressing refresh marks the list
  currently on screen as seen *before* fetching, so whatever the refresh brings
  stands out. There is also a "mark as seen" button for clearing the badges
  without refetching.
- **Nothing is new on a first run.** An empty state means never acknowledged, and
  badging all 30 rows would say nothing. Badges start appearing after the first
  refresh.
- **Only what is on screen is stored** (`data/seen.json`, keyed by accountId), so
  the file cannot grow forever. An issue that leaves the 30-day window and comes
  back later is simply new again — arguably right, since you have not seen it in
  a month.
- A hidden row that gets a new comment loses its dismissal *and* is badged: the
  two watermarks are the same comment id, so the chain works out.

## Search

- **Fuzzy, client-side, over the items already loaded** (Fuse.js). No Jira call,
  nothing to index server-side, and it searches what you can see — including the
  text of the comment that mentioned you.
- **The threshold is 0.38.** Low enough that a query is not a list of everything,
  high enough to absorb a dropped or swapped letter. Expect the occasional loose
  match at the bottom of the results: that is the cost of tolerating typos.
- **A full issue key is answered exactly**, not fuzzily. Pasting `ABC-1234` would
  otherwise also return the dozen keys of the same project that are one edit
  away. A key that is not on screen falls back to a fuzzy match, so a typo in a
  key still finds something.
- **Search reorders by relevance**, so while a query is active the priority order
  is not what you see. The totals in the header stay global on purpose: they
  describe the workload, not the current view.

## Sorting

- `Not Clear` is ranked above `Low` by a manual override in
  `config/priority.ts`. Jira returns it last, below `Very Low`, which would bury
  every undecided ticket.
- Due dates are compared as `YYYY-MM-DD` strings in the machine's timezone. If
  you run this in a very different timezone from Jira's, "overdue today" can be
  off by a day.

## Caching and cost

- The cache is a **module-level Map in the dev server process**. Restarting
  `pnpm dev` empties it. No persistence, by design.
- A cold load for the default user is **~65 Jira calls in ~5s**: 1 search, ~50
  comment fetches, 13 board queries, plus priorities and boards. A cache hit is
  ~80ms and 0 calls. A colleague with a light load cost 15 calls.
- TTLs: tasks 30 min, users/boards/priorities 1 h. Refresh drops the selected
  user's tasks plus the board and priority lists, so a board created since the
  last load is picked up immediately instead of after an hour.
- **Nothing pre-warms the cache.** The first load after the 30 minutes are up
  pays full price.
- **Reloading the page costs nothing.** It still calls /api/tasks, but inside the
  30-minute window that is served from memory with zero Jira calls. Only the
  refresh button fetches. The header shows how old the data is, in amber past 15
  minutes.
- **Rate limits, as the instance reports them**: a token bucket of 350 requests
  (200 on `/search/jql`) refilling at 100/second, policy `jira-burst-based`
  (`q=100; w=1`). A cold load spends 64 of it over ~5s with at most 5 requests in
  flight, so it uses a few percent of the bucket. Hitting the limit would take a
  sustained ~100 requests/second.
- **The budget belongs to the token's account.** If that account is a shared
  integration user, other systems using it draw on the same bucket. The client logs a warning when less than 20% is left, and
  retries 429s honouring `Retry-After`.

## Environment

- **Port 3000 was already taken** on this machine by another Next app, so the dev
  server usually lands on 3001. Not an app problem, but it surprises.
- **`pnpm test:e2e` builds and serves on port 3100** rather than reusing
  `next dev`, because Next allows only one dev server per directory — reusing dev
  would fail whenever one is already open. It costs a build per run.
- **The e2e tests hit the live Jira instance**, read-only. They assert on
  structure and behaviour, never on issue keys or counts, so they survive the
  data changing daily. They will fail without network or with a bad token.
- The UI speaks **Italian, English and German**, chosen from the browser's
  language and overridable with the header picker; the choice is kept in
  localStorage. Italian is the fallback for any other language. The server
  renders the fallback first, since it cannot know the browser's preference —
  harmless here, because the first paint is a near-textless skeleton.
- **Dates, times and relative ages go through Intl**, so "3 giorni fa" and "vor 3
  Tagen" are not hand-written. Counts are functions in the dictionaries, because
  plural rules differ per language.
- **Error messages are translated by code, not by text.** The API returns an
  error code and an English message; the UI shows its own wording for known
  codes and falls back to the server's text otherwise.
- The theme follows the OS by default; the header
  button cycles system -> light -> dark and the choice is kept in localStorage
  (per browser, unlike hidden rows, which are on the server). A small inline
  script applies the class before the first paint, so there is no flash of the
  wrong theme on reload.
- Inactive accounts are filtered out of the picker (99 of 544 accounts are active
  humans), but an inactive accountId passed in the URL still resolves and shows
  that person's workload, rather than erroring.

## What would break if this were deployed

Not a plan, just the analysis, so it does not have to be redone. The app is
localhost-only by design and nothing here is prepared for.

- **There is no authentication.** A public URL would expose the whole team's Jira
  workload, and `?user=<accountId>` would let anyone walk through all 99
  selectable people. This is the blocker, not the storage.
- **`data/dismissals.json` would not survive.** On a serverless host the
  filesystem is read-only apart from `/tmp`, which is per-instance and wiped. The
  failure mode is the nasty kind: hiding a row would appear to work, then undo
  itself whenever another instance answers.
- **The cache is a Map in one process.** Per-instance, so the 30-minute window
  becomes a coin flip and cold loads multiply — each one 64 calls against a
  service-account budget shared with production systems.
- **A cold load takes ~5s**, against a 10s function limit on the smaller plans.
  Fine most days, a timeout on a slow one.

Fixing it means Redis (Vercel KV/Upstash) replacing both the file and the memory
cache, plus real access control — and, if several people used it, per-viewer
OAuth so everyone sees with their own permissions instead of the service
account's. For reaching it from another device of your own, a tunnel
(Tailscale, Cloudflare) over the local app needs no code changes at all.

## Not implemented, deliberately

No writes to Jira, no login or sessions, no database, no deployment config, no
multi-token or multi-viewer support, no historical metrics.
