# Work Dashboard

A local dashboard that answers one question for a selectable person: **what do I
have to do right now?** It reads your tracker and puts everything that is waiting
on you — assigned work *and* comments where you were asked something and never
replied — into a single ranked list.

> **Supports Jira Cloud only, for now.** The whole data layer is Jira-specific:
> JQL queries, Atlassian Document Format comment parsing, the Agile board API.
> Nothing here is abstracted over other trackers, and there is no adapter layer
> pretending otherwise. Jira **Data Center/Server** is untested — the API version
> and the auth header differ, and comment bodies are wiki markup rather than ADF.
> GitHub, Linear, Azure DevOps and friends are not supported.

Two sources, both computed against the selected user's `accountId`:

1. **Assigned** — issues assigned to them that are not in a final status.
2. **Unanswered mentions** — issues *not* assigned to them where they were
   mentioned in a comment and have not commented since. Mentions that only put
   you on a "fyi" line do not count, and you can hide any of them until a newer
   comment arrives.

Everything lands in **one flat list**, sorted by priority, then due date (missing
dates last), then last update. The board an issue belongs to is a column on the
row and a filter above the list, not a section heading. A fuzzy full-text search
(press `/`) finds a ticket by anything on the row — key, summary, labels, board,
assignee, the comment that mentioned you — and survives a typo.

Runs on `localhost` only, for one person, with one API token. There is no login
and no multi-user support, by design — see
[what would break if this were deployed](NOTES.md).

Available in **Italian, English and German**: the interface follows your browser's
language, and a picker in the header overrides it.

Contributions are welcome; start with [CONTRIBUTING.md](CONTRIBUTING.md).

## Requirements

- Node 20+ (developed on 24)
- pnpm
- A Jira **Cloud** API token

## Setup

```bash
pnpm install
cp .env.example .env.local   # then fill it in
pnpm probe                   # verify access before starting the app
pnpm dev
```

### `.env.local`

| Variable | What it is |
| --- | --- |
| `JIRA_BASE_URL` | `https://your-domain.atlassian.net`. A bare host works too. |
| `JIRA_EMAIL` | The Atlassian account email the token belongs to. |
| `JIRA_API_TOKEN` | The API token. Never logged, never sent to the browser. |
| `JIRA_AUTH_MODE` | `basic` for Jira Cloud. `bearer` exists for Data Center PATs but this app targets Cloud. |
| `JIRA_DEFAULT_ACCOUNT_ID` | Whose workload to show when no user is selected. |

**Creating the API token**: <https://id.atlassian.com/manage-profile/security/api-tokens>
→ *Create API token*, copy it once, paste it into `.env.local`. Jira Cloud sends
it as HTTP Basic auth, base64 of `email:token` — which is why both the email and
the token are needed.

**Finding an accountId**: `pnpm probe "your.name@example.com"` prints the
matching accounts. An `accountId` looks like
`712020:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee`.

### Why `JIRA_DEFAULT_ACCOUNT_ID` exists

`/rest/api/3/myself` is not necessarily the right default: if your token belongs
to a shared integration account — as it did where this was built — then "me" is
not the token's identity. So the default user is configured explicitly, and every
query is parameterised on an `accountId`. `currentUser()` is never used.

It also means **all Jira calls carry the token owner's permissions**, not the
selected user's. A project the token cannot see is invisible here, whoever is
selected.

## Commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | Dev server (port 3000, or the next free one). |
| `pnpm probe [query] [accountId]` | Standalone Jira diagnostic: identity, which search endpoint is live, which JQL clauses work, priorities, boards, user-directory permission. `query` looks a user up; `accountId` runs the JQL matrix as that person. |
| `pnpm test` | Unit tests (mention rule, board resolution, ordering, search, cache isolation). |
| `pnpm test:e2e` | Browser tests against a built app. |
| `pnpm typecheck` / `pnpm lint` | Types and lint. |
| `pnpm build` | Production build. |

## How it fits together

```
app/api/users       -> the picker: active human accounts, cached 1h
app/api/tasks       -> the finished payload for one accountId, cached 30min
app/api/dismissals  -> mentions you chose to hide, persisted on disk
lib/jira/*          -> Jira client, search, comments, boards, priorities (server only)
lib/jira/mentions   -> the unanswered-mention rule, as pure functions
lib/grouping        -> the board on each row, the tie-break, the filter facets
lib/sorting         -> priority/due-date/updated ordering
lib/cache.ts        -> in-memory TTL cache, keyed by accountId
lib/dismissals      -> the hide-until-next-comment rule
lib/dismissals-store -> where hidden rows are written (data/dismissals.json)
lib/theme*          -> the light/dark choice, and the script that applies it
lib/i18n/*          -> the message dictionaries, and how a locale is chosen
lib/search.ts       -> the fuzzy index and how a query is answered
config/*            -> the knobs: window, caps, board priority, priority order
```

The browser only imports types and pure helpers — `lib/dashboard-types.ts`,
`lib/dismissals.ts`, `lib/grouping.ts`, `lib/format.ts`, `lib/theme*.ts`,
`lib/i18n/*`. None of them read the environment, so credentials cannot reach the
bundle.

## Assumptions this app makes

- **Jira Cloud, API v3.** The legacy `/rest/api/3/search` answers 410 on current
  instances, so search pages only with `nextPageToken`. The Agile API still
  uses `startAt`, and comments still use `startAt`.
- **The instance rejects unbounded JQL**, so every query carries a restricting
  clause.
- **Mentions are detected in ADF**, by matching `{type: "mention", attrs: {id}}`
  against the accountId, plus the legacy `[~accountid:…]` wiki form. Never by
  display name — on the measured instance that search returns nothing, and
  homonyms make it unsafe anyway.
- **"Answered" means a comment**, by the target user, after the last mention.
  Status transitions do not count.
- **A mention on a "fyi" line is not a question.** If the line holding the
  mention contains nothing but `fyi` / `cc` / `per conoscenza` and other
  mentions, it counts as being kept informed and is dropped from the list.
- **Mentions on closed issues stay**, as long as they are unanswered.
- **A mention you hide stays hidden until a newer comment mentions you.** The
  dismissal records which comment it applied to, so anything new brings the row
  back by itself. Assigned issues cannot be hidden.
- **Boards are resolved by querying each board's issues**, since an issue has no
  board field in Jira. Only boards located in the projects present in the issue
  set are queried.

Known limits and things that behave awkwardly against the real instance are in
[NOTES.md](NOTES.md).

## License

MIT — see [LICENSE](LICENSE).
