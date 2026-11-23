# Overview

`wherewerewe` keeps the notes of one long coding agent session, and prints them back as one short
brief after each compaction. The store, the note writes and the brief are built. Checks, owner
notes, hooks and the other commands come in later pull requests, and until then they exit 2.

## The package

The `@wherewerewe/cli` package in `packages/cli/` installs two commands, `www` and `wherewerewe`,
that run the same file. Agents and people type `www`, because it is short. A script or a hook calls
`wherewerewe`, because no other common tool uses that name.

The package ships its TypeScript source, and Bun runs it, so the repo has no build step.
`ts-pattern` is its only runtime dependency.

## The store

Each session keeps its state in one folder of plain text files under `$XDG_STATE_HOME/wherewerewe/`,
or under `~/.local/state/wherewerewe/` when that is unset. `session` holds the goal and the item in
focus, `items.tsv` the open items, and `journal.tsv` every write. A write takes the folder's `lock`
file, appends its journal rows, rewrites `items.tsv` and `session` through a temporary file and a
rename, and removes the lock. The journal comes first, so a write that stops half way leaves a close
recorded and its item still open, never an item gone with no record. The journal stays closed except
for the ids that `done`, `drop` and `use` closed, which a write reads to refuse a closed id.
[The store design](../design/wherewerewe/store.md) fixes the formats.

## Finding the session

A command finds its session from `--session`, then `WHEREWEREWE_SESSION`, then the binding of the
agent session id in `CLAUDE_CODE_SESSION_ID` or `CODEX_SESSION_ID`. `init` and `attach` write a
binding file under `.bindings/`, and `detach` removes it. With no match the command exits 4, and
never falls back to the only session on the machine. See
[sessions and hooks](../design/wherewerewe/sessions-and-hooks.md).

## Commands and refusals

This version has `help`, `sessions`, `init`, `attach`, `detach`, `goal`, `now`, `task`, `wait`,
`rule`, `where`, `set`, `done` and `drop`, and `www` alone prints the brief. A write answers in one
line that ends with the brief's length. Each refusal prints its text and a `Run:` line with the
command that fixes it. [The commands design](../design/wherewerewe/commands.md) lists the replies
and the refusals.

## The brief

`www` prints the goal, the item in focus, and the open tasks, waits, approvals, rules and where
items, in at most 52 lines and 6,400 characters. No check runs yet, so each tag reads
`not checked yet` or the item's age. When a row of `items.tsv` does not parse, `www` still prints
the rows that do, and names the broken row on stderr.
[The brief design](../design/wherewerewe/brief.md) fixes the layout.
