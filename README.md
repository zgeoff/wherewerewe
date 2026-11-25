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

**wherewerewe** keeps the notes of one long agent session as short labelled rows. After each
compaction your agent runs `www` and gets back the goal, what you allowed, and what is still open.

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
`--session tide-alerts` to each command.

### Write as you go

A row is one fact in one line, under any label you choose:

```text
$ www task "Write alerts-e2e against staging" --note "Use the recorded tide fixtures"
{"ok":true,"id":"task-1","label":"task"}

$ www grant "merge the alert PRs once CI is green"
{"ok":true,"id":"grant-1","label":"grant"}

$ www decide "Retry a 503 from the tide feed 3 times, 2 s apart" --why "The feed returns 503 for about 4 s during its hourly refresh"
{"ok":true,"id":"decision-1","label":"decision"}

$ www done task-1 --evidence "alerts-e2e run 412 passed"
{"ok":true,"id":"task-1","closed":"done"}
```

### After a compaction

Run `www` and read the session back:

```text
$ www
tide-alerts · 5 open rows · last write 2m ago
GOAL   Ship tide alerts behind the tide_alerts flag; done when alerts-e2e passes on staging
GRANT  grant-1  merge the alert PRs once CI is green
NOW    Write the first alert case
WAIT   wait-1  Review of the tide feed PR [dana]
DECISION
       decision-1  Retry a 503 from the tide feed 3 times, 2 s apart
                   note: why: The feed returns 503 for about 4 s during its hourly refresh
Everything: www rows | jq   ·   Write: www <label> "<text>"   ·   www help
```

### Find things again

`www rows` prints every open row as JSON lines, for `jq` and `grep`:

```sh
www rows | jq -r 'select(.label=="decision") | "\(.id)  \(.text)"'
www rows --all | grep -i certificate
```

## Features

- **[Rows](./docs/design/wherewerewe/README.md#the-row):** every note is a labelled line of at most
  300 characters, with an optional note of detail.
- **[The brief](./docs/design/wherewerewe/README.md#the-brief):** the goal, the pin, the grant, the
  next step, the waits and each other label, in one read.
- **[The grant](./docs/design/wherewerewe/README.md#the-row):** your words on what the agent may do
  and what you keep back, printed whole.
- **[The gate](./docs/design/wherewerewe/README.md#the-gate):** after a compaction, hooks hold the
  agent's tool calls until it reads its brief.
- **[One plain file](./docs/design/wherewerewe/README.md#the-file):** JSON lines that the tool only
  appends to, readable with `jq`.

## Documentation

wherewerewe keeps each session in `~/.local/state/wherewerewe/<name>/`. Read
[docs/](./docs/README.md) for the design and the decisions.
