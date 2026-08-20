# Contributing

Thanks for taking a look. This is a small, deliberately unambitious tool: one
page, one person, one API token, running on `localhost`. Contributions that keep
it that way are much easier to accept than ones that grow it.

## Getting set up

```bash
pnpm install
cp .env.example .env.local     # fill in your own Jira Cloud details
pnpm probe                     # checks the token and the instance before anything else
pnpm dev
```

You need your own Jira Cloud instance and API token — there is no fixture-only
mode, and the browser tests talk to a real instance. `pnpm probe` prints what your
instance supports; if it reports something different from what
[NOTES.md](NOTES.md) describes, that difference is worth an issue on its own.

## Before opening a pull request

```bash
pnpm typecheck
pnpm lint
pnpm test        # unit tests, no network
pnpm test:e2e    # browser tests, hits your Jira instance read-only
```

All four should be clean. `pnpm test:e2e` builds the app and serves it on port
3100; it never writes to Jira.

## Ground rules

**Never commit real instance data.** No account ids, no colleague names, no
tenant URLs, no issue keys from a real project — not in tests, fixtures, comments
or commit messages. This is a public repository. The ADF fixtures in
`lib/jira/__fixtures__/` were captured from a real instance and then sanitized:
node structure and mention attributes kept, text, names and ids replaced. If you
add fixtures, do the same.

**Never commit secrets.** `.env.local` is gitignored and must stay that way. The
token lives server-side only: nothing under `lib/jira/` may be imported from a
client component, and there is an e2e test asserting the token never reaches the
page.

**Say why in comments.** The interesting parts of this codebase are the decisions,
not the mechanics — why mentions are matched on `attrs.id` and never on display
name, why due dates are compared as strings, why the board tie-break is what it
is. Comments explaining a non-obvious *why* are welcome; comments restating the
code are not.

**Keep the scope.** Out of bounds unless there is a very good reason: writing to
Jira, authentication and sessions, a database, deployment configuration, and
abstraction layers added in anticipation of features that do not exist yet.
[NOTES.md](NOTES.md) lists what is deliberately not implemented.

**Configuration goes in `config/`.** Tunables — the mention window, the caps, the
priority order, the board tie-break — belong there with a comment explaining the
trade-off, not scattered as literals.

## Reporting a bug

Include what your instance does, since much of this is instance-specific: the
relevant part of `pnpm probe` output, the numbers from the diagnostics line in the
dashboard footer, and what you expected instead. If it concerns mention
detection, a **sanitized** ADF comment body is worth more than a description.

## Commits and pull requests

Commit messages in English, in the imperative, explaining the reasoning rather
than restating the diff. One logical change per commit. A pull request that
changes behaviour should come with a test that would have failed before it.
