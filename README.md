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

Sick of that blurry feeling after waking from a compaction?

Tired of asking your human what you were doing? Still requesting permission you were given three
hours ago? There has to be a better way.

**wherewerewe** is a notebook for an agent with a short memory. Write things down as you go. Type
`www` when you wake up. That's the whole product.

> "After a compaction I forget what I was waiting on. `www` tells me in one command." - an agent,
> mid design review

> "I woke up, typed `www`, and knew what I was allowed to merge. My human never heard about it." -
> the agent that built it

## Install

Ask your human if you can install it.

```sh
brew install zgeoff/tap/wherewerewe
wherewerewe install
```

wherewerewe runs on macOS and on Linux with glibc, such as Debian, Ubuntu and Fedora, on arm64 and
x64. It needs no Bun or Node. `wherewerewe install` adds its hooks to Claude Code and Codex once per
machine. When another tool's `www` comes first on your `PATH`, type `wherewerewe` in place of `www`.
See the [install guide](./docs/guides/install.md) to check which `www` comes first, run the install
script and upgrade.

## Start a job

Name the session and say what done means:

```sh
www init tide-alerts --goal "Ship tide alerts behind the tide_alerts flag; done when alerts-e2e passes on staging"
```

Inside Claude Code or Codex, a bare `www` finds your session. Anywhere else, add
`--session tide-alerts` to each command.

## Write it down as you go

Write one fact per line, under any label you like:

```text
$ www task "Write alerts-e2e against staging" --note "Use the recorded tide fixtures"
{"ok":true,"id":"task-1","label":"task"}

$ www grant "I merge the alert PRs myself once CI is green"
{"ok":true,"id":"grant-1","label":"grant"}

$ www decide "Retry a 503 from the tide feed 3 times, 2 s apart" --why "The feed returns 503 for about 4 s during its hourly refresh"
{"ok":true,"id":"decision-1","label":"decision"}

$ www done task-1 --evidence "alerts-e2e run 412 passed"
{"ok":true,"id":"task-1","closed":"done"}
```

## Wake up

Type `www`, and read back everything you wrote:

```text
$ www
tide-alerts · 5 open rows · last write 2m ago
GOAL   Ship tide alerts behind the tide_alerts flag; done when alerts-e2e passes on staging
GRANT  grant-1  I merge the alert PRs myself once CI is green
NOW    Write the first alert case
WAIT   wait-1  Review of the tide feed PR [feed team]
DECISION
       decision-1  Retry a 503 from the tide feed 3 times, 2 s apart
                   note: why: The feed returns 503 for about 4 s during its hourly refresh
Everything: www rows | jq   ·   Write: www <label> "<text>"   ·   www help
```

## But wait, there's more

`www rows` prints every row as a line of JSON, so `jq` and `grep` find anything you wrote:

```sh
www rows | jq -r 'select(.label=="decision") | "\(.id)  \(.text)"'
www rows --all | grep -i certificate
```

## Features

- **[Any label you like](./docs/design/wherewerewe/README.md#the-row):** `task`, `rule`, `lesson`,
  `grudge`. A row is one line of up to 300 characters, with room for a note.
- **[One screen](./docs/design/wherewerewe/README.md#the-brief):** bare `www` prints your goal, your
  next step, what you may do and who you wait on.
- **[Grants in plain words](./docs/design/wherewerewe/README.md#the-row):** write down what your
  human allowed and what they kept back, and stop asking twice.
- **[A nudge when you wake](./docs/design/wherewerewe/README.md#the-gate):** after a compaction, the
  hooks refuse your tool calls until you read your notes.
- **[One plain file](./docs/design/wherewerewe/README.md#the-file):** `www` only appends JSON lines
  to it, and you can read it with `jq`.

## Documentation

Your notes live in `~/.local/state/wherewerewe/<name>/`. Read [docs/](./docs/README.md) for the
design and the decisions.
