<div align="center">
  <h1>wherewerewe</h1>

  <p>
    <a href="https://github.com/zgeoff/wherewerewe/releases/latest"><img src="https://img.shields.io/github/v/release/zgeoff/wherewerewe" alt="latest release"></a>
    <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT license"></a>
  </p>

  <p>
    <a href="./docs/README.md">Documentation</a> •
    <a href="./docs/guides/install.md">Install</a>
  </p>
</div>

**wherewerewe** keeps the notes of one long agent session as plain files. After each compaction your
agent runs `www` and gets back the goal, what you allowed, and what is still open.

What the agents that built and tried wherewerewe said about it, lightly edited; the second was
written for fun.

> "After a compaction I forget what I was waiting for. www is where I wrote it down." - Fable 5.2

> "www reminded me that I could mark a task done and that deleting it needed approval. Buy milk is
> safe with me." - Astra 6.2

> "www still knew what I owed and what I'd decided, so I never had to go back and ask my boss." -
> Opus 5.5

## Install

```sh
brew install zgeoff/tap/wherewerewe
wherewerewe install
```

wherewerewe runs on macOS and on Linux with glibc, such as Debian, Ubuntu and Fedora, on arm64 and
x64. It needs no Bun or Node. `wherewerewe install` adds its hooks to Claude Code and Codex once per
machine, and Codex asks you to trust them in `/hooks`. When another tool's `www` comes first on your
`PATH`, type `wherewerewe` in place of `www`. See the [install guide](./docs/guides/install.md) to
check which `www` comes first, run the install script and upgrade.

## Usage

### Start a session

Name the session and say what done means:

```sh
www init tide-alerts --goal "Ship tide alerts behind the tide_alerts flag; done when alerts-e2e passes on staging"
```

Inside Claude Code or Codex, a bare `www` finds the session. Anywhere else, add
`--session tide-alerts` to each command, as the snippets below do.

### Write as you go

Record each task and decision when it happens:

```text
$ www --session tide-alerts task t-e2e "Write alerts-e2e against staging"
t-e2e  task, open, no check. Brief: 181 of 20000 tokens.

$ www --session tide-alerts decide "Retry a 503 from the tide feed 3 times, 2 s apart" --why "The feed returns 503 for about 4 s during its hourly refresh" --on t-e2e
d-1  decision on t-e2e. Read it with: www show t-e2e. Brief: 208 of 20000 tokens.
```

### After a compaction

Run `www` and read the session back:

```text
$ www --session tide-alerts
tide-alerts · day 1 · Wed 2026-11-25 08:12Z · last write 0m ago · no checks
GOAL  Ship tide alerts behind the tide_alerts flag; done when alerts-e2e passes on staging
GRANT  from the owner in chat, 0m ago
  may    • merge the alert PRs once CI is green
  never  • the prod push certificate
  reading: covers merges on green CI; kept back: the prod push certificate
NOW  t-e2e · set 0m ago · note 0m ago
  next: write the first alert case
    Use the recorded tide fixtures, not the live feed.
…
```

### Leave your agent a note

From a terminal outside any agent, tell it something it must not lose:

```text
$ www --session tide-alerts say "Use the recorded tide fixtures for e2e, not the live feed" --on t-e2e
o-1  owner note on t-e2e. It shows in every brief until you run: www --session tide-alerts ack o-1. Brief: 300 of 20000 tokens.
```

## Features

- **[Brief](./docs/design/wherewerewe/brief.md):** the goal, the grant, owner notes, what changed,
  open work and waits, in one read.
- **[Checks](./docs/design/wherewerewe/checks.md):** a claim can name a pull request, branch, path
  or process, and `www` checks it live.
- **[The grant](./docs/design/wherewerewe/commands.md):** your words on what the agent may, may not
  and must never do, printed whole.
- **[Owner notes](./docs/design/wherewerewe/owner-notes.md):** you write and clear them from a
  terminal outside any agent, and the agent cannot clear one.
- **[Hooks](./docs/design/wherewerewe/sessions-and-hooks.md):** after a compaction, they hold the
  agent's tool calls until it reads its brief.
- **[Plain files](./docs/design/wherewerewe/store.md):** tab-separated text, with a journal that
  deletes nothing, readable with `less`.

## Documentation

wherewerewe keeps each session in `~/.local/state/wherewerewe/<name>/`. Read
[docs/](./docs/README.md) for the design and the decisions.
