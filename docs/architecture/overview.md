# Overview

`wherewerewe` keeps the notes of one long coding agent session, and prints them back as one short
brief when the agent runs `www`. It has the store, the note writes, approvals, decisions, the two
history reads and the brief. A command it does not have exits 2.

## The package

The `@wherewerewe/cli` package in `packages/cli/` installs two commands, `www` and `wherewerewe`,
that run the same file. Agents and people type `www`, because it is short. A script or a hook calls
`wherewerewe`, because no other common tool uses that name.

The package ships its TypeScript source, and Bun runs it, so the repo has no build step.
`ts-pattern` is its only runtime dependency.

## The store

Each session keeps its state in one folder of plain text files under `$XDG_STATE_HOME/wherewerewe/`,
or under `~/.local/state/wherewerewe/` when that is unset. `session` holds the goal and the item in
focus, `items.tsv` the open items, and `journal.tsv` every write. A session never reuses a closed
id, so a write reads from the journal the ids that `done`, `drop` and `use` closed, the decision
numbers and who made each decision, and nothing else. See
[the store design](../design/wherewerewe/store.md) for the formats.

A write takes the folder's `lock` file, appends its journal rows, rewrites `items.tsv` and `session`
through a temporary file and a rename, and removes the lock. The journal comes first, so a write
that stops half way leaves a close recorded and its item still open, never an item gone with no
record. A writer wins the claim file named after the lock and reads the lock again before it removes
that lock, its own or a stale one, so one writer is inside at a time as long as each write finishes
within the stale age the store design sets; a write that runs longer can lose the lock to the next
writer.

## Finding the session

A command finds its session from `--session`, then `WHEREWEREWE_SESSION`, then the binding of the
agent session id in `CLAUDE_CODE_SESSION_ID`, or in `CODEX_SESSION_ID`, or `CODEX_THREAD_ID` when
that is unset. An empty id, or one with a character a file name cannot hold, counts as unset. `init`
and `attach` write a binding file under `.bindings/`, and `detach` removes it. With no match the
command exits 4, and never falls back to the only session on the machine. See
[sessions and hooks](../design/wherewerewe/sessions-and-hooks.md).

## Commands and refusals

This version has `help`, `sessions`, `init`, `attach`, `detach`, `goal`, `now`, `task`, `wait`,
`rule`, `where`, `set`, `ok`, `decide`, `done`, `drop`, `use`, `show` and `log`, and `www` alone
prints the brief. A write answers in one line that ends with the brief's length. Each refusal prints
its text and a `Run:` line with the command that fixes it. See
[the commands design](../design/wherewerewe/commands.md) for the replies and the refusals.

## Approvals and decisions

`ok` writes an approval as an item that keeps the owner's exact words as its claim, with who gave
them, where, what they cover and whether they are `--once` or `--standing`. The brief holds three.
`use` spends a `--once` approval: it leaves `items.tsv` and stays in the journal with what the agent
did with it. A standing approval is never spent.

`decide` writes a decision, or with `--ruled-out` an approach that lost, as a journal row and no
item. The tool numbers it `d-<n>`, one past the highest decision in the journal. A decision made by
the owner can be replaced only by a decision recorded with `--who owner`.

## Reading the journal

`show <id>` prints one open item, closed item or decision, with the decisions made about it and its
last 10 journal rows. `log` prints the journal oldest first, kept to the rows that `--since`, `--op`
and `--id` name, and sorts them by time. Both read the journal in chunks and hold only the rows they
need, and take no lock. Once the session is found, neither is refused for a missing or unreadable
thing: an unknown id lists the open items, and an unreadable journal prints the item without its
history and says so on stderr. Only a `--since` that `log` cannot read exits 2.

## The brief

`www` prints the goal, the item in focus, and the open tasks, waits, approvals, rules and where
items, in at most 52 lines and 6,400 characters. The brief runs no check, so each tag reads
`not checked yet` or the item's age. When a row of `items.tsv` does not parse, `www` still prints
the rows that do, and names the broken row on stderr. See
[the brief design](../design/wherewerewe/brief.md) for the layout.
