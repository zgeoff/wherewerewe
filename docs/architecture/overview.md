# Overview

`wherewerewe` keeps the notes of one long coding agent session, and prints them back as one short
brief when the agent runs `www`. It has the store, the note writes, approvals, decisions, the two
history reads, the import of a hand-kept store, the owner's notes and the brief. A command it does
not have exits 2. Read this before you change the package, then open the design doc that the section
you change links.

## The package

The `@wherewerewe/cli` package in `packages/cli/` installs two commands, `www` and `wherewerewe`,
that run the same file. Agents and people type `www`, because it is short. A script or a hook calls
`wherewerewe`, because no other common tool uses that name.

The package ships its TypeScript source, and Bun runs it, so the repo has no build step.
`ts-pattern` is its only runtime dependency.

## The store

Each session keeps its state in one folder of plain text files under `$XDG_STATE_HOME/wherewerewe/`,
or under `~/.local/state/wherewerewe/` when that is unset. `session` holds the goal and the item in
focus, `items.tsv` the open items, `owner.tsv` the owner's notes that still show, and `journal.tsv`
every write. `init` and `import` create `owner.tsv`, and only `say` and `ack` rewrite it. A session
never reuses a closed id, so a write reads from the journal the ids that `done`, `drop` and `use`
closed, the decision numbers, who made each decision and the highest owner note number, and nothing
else. See [the store design](../design/wherewerewe/store.md) for the formats.

A write takes the folder's `lock` file, appends its journal rows, rewrites `items.tsv` and `session`
through a temporary file and a rename, and removes the lock. The journal comes first, so a write
that stops half way leaves a close recorded and its item still open, never an item gone with no
record. A writer wins the claim file named after the lock and reads the lock again before it removes
that lock, its own or a stale one, so one writer is inside at a time as long as each write finishes
within the stale age the store design sets, measured on the wall clock. A write that runs longer can
lose the lock to the next writer, and so can a write during which the clock jumps forward by more
than that age.

## Finding the session

A command finds its session from `--session`, then `WHEREWEREWE_SESSION`, then the binding of the
agent session id in `CLAUDE_CODE_SESSION_ID`, or in `CODEX_SESSION_ID`, or `CODEX_THREAD_ID` when
that is unset. An empty id, or one with a character a file name cannot hold, counts as unset. `init`
and `attach` write a binding file under `.bindings/`, and `detach` removes it. With no match the
command exits 4, and never falls back to the only session on the machine. See
[sessions and hooks](../design/wherewerewe/sessions-and-hooks.md).

## Commands and refusals

This version has `help`, `sessions`, `init`, `attach`, `detach`, `goal`, `now`, `task`, `wait`,
`rule`, `where`, `set`, `ok`, `decide`, `done`, `drop`, `use`, `show`, `log`, `import`, `say` and
`ack`, and `www` alone prints the brief. A write answers in one line. The reply of a note write,
such as `task`, `done`, `decide`, `say` or `ack`, names the note or item and ends with the brief's
length; `init`, `attach`, `detach` and `import` say what they did, and `import` names the folder of
the backup. Each refusal prints its text and a `Run:` line with the command that fixes it. See
[the commands design](../design/wherewerewe/commands.md) for the replies and the refusals.

## Approvals and decisions

See [the commands design](../design/wherewerewe/commands.md) for the flags and replies, and
[the store design](../design/wherewerewe/store.md) for the rows each writes.

`ok` writes an approval as an item that keeps the owner's exact words as its claim, with who gave
them, where, what they cover and whether they are `--once` or `--standing`. The brief holds three.
`use` spends a `--once` approval: it leaves `items.tsv` and stays in the journal with what the agent
did with it. A standing approval is never spent.

`decide` writes a decision, or with `--ruled-out` an approach that lost, as a journal row and no
item. The tool numbers it `d-<n>`, one past the highest decision in the journal. A decision made by
the owner can be replaced only by a decision recorded with `--who owner`.

## Owner notes

`say` and `ack` run only when stdin and stdout are terminals and none of `CLAUDECODE`,
`CLAUDE_CODE_SESSION_ID`, `CODEX_SESSION_ID`, `CODEX_THREAD_ID` or `CODEX_CI` has a value. A
variable with an empty value counts as unset. `cli.ts` reads the two descriptors once and passes the
answer in, and `run-cli.ts` checks both conditions right after the arguments parse, before it finds
the session.

In an agent shell the command exits 3 and the agent records what the owner said as a rule, a wait or
an approval instead. The check catches an agent that writes a note by mistake. An agent that fakes a
terminal and clears the variables passes it. See
[the owner notes design](../design/wherewerewe/owner-notes.md) for what the conditions leave open.

`say` numbers a note `o-<n>`, one past the highest `o-<n>` among the journal's `say` rows and the
notes that show, so an acknowledged note's number is never reused. `say` and `ack` take the store
lock, append their journal row, and then replace `owner.tsv` through a temporary file and a rename.
A stop between the two leaves a `say` that never shows and uses up its number, or an `ack` whose
note still shows until the next `ack`. No other command rewrites `owner.tsv`.

The brief shows at most 2 notes, oldest first, right after the goal, until `ack` clears them. A row
of `owner.tsv` that does not parse is left out of the brief and named on stderr, and `say` and `ack`
refuse until the owner fixes the file. Every other write works as before. See
[the store design](../design/wherewerewe/store.md) for the file format.

## Reading the journal

See [the commands design](../design/wherewerewe/commands.md) for the filters and replies, and
[the store design](../design/wherewerewe/store.md) for the journal format.

`show <id>` prints one open item, closed item or decision, with the decisions made about it and its
last 10 journal rows. `log` prints the journal oldest first, kept to the rows that `--since`, `--op`
and `--id` name, and sorts them by time. Both read the journal in chunks and hold only the rows they
need, and take no lock. Once the session is found, neither is refused for a missing or unreadable
thing: an unknown id lists the open items, and an unreadable journal prints the item without its
history and says so on stderr. Only a `--since` that `log` cannot read exits 2.

## Importing a hand-kept store

`www import <session>` converts a session folder whose `session` file says `format=0-by-hand`, or
has no `format` line, to format 1 in place. It takes the session's lock, reads the three hand-kept
files, and checks every row against the write rules. When any row breaks a rule, it exits 3 with one
line per row and changes no file. See [the store design](../design/wherewerewe/store.md) for the
conversion and [the commands design](../design/wherewerewe/commands.md) for the refusal text.

Otherwise, when an agent session runs it, it takes the lock in `.bindings/` that every binding
change takes, so a busy lock converts nothing. It copies `session`, `items.tsv` and `journal.tsv`
into `import-backup/` through a temporary folder and a rename, so `import-backup/` is either absent
or complete. It writes each new file in full to a temporary file, and renames them into place in
this order: `owner.tsv`, `prs.tsv`, `items.tsv`, `journal.tsv` and `session`, and writes the binding
last, so a stopped import never leaves the agent bound to a hand-kept store. A store whose `session`
file still has `format=0-by-hand` has not finished importing. A rerun reads the originals from
`import-backup/` when it exists, removes any `import-backup.tmp-*` folder and any temporary file a
stopped import staged, and converts the store again. The backup and each new file keep the
permissions of the file they replace, and a new `owner.tsv` or `prs.tsv` takes those of `session`.

A rerun refuses a store that is format 1 already. When an agent session runs it, the refusal's
`Run:` line is `www attach <session>`, which binds an agent that an import left unbound by stopping
after its last rename and before its binding.

An item that a hand-kept `done`, `closed`, `drop` or `use` journal row closes leaves `items.tsv`. A
hand-kept journal settles a question or an item with a `closed` row. A question cannot reuse a
closed id. An item holds only the `extra` keys of its kind: `use`, `where` and `scope` on an
approval, `blocked_by` on a task, `who` on a wait or an approval. A refusal never prints a value
that looks like a credential.

## The brief

`www` prints the goal, the item in focus, and the open tasks, waits, approvals, rules and where
items, in at most 52 lines and 6,400 characters. The brief runs no check: an item with a check shows
the last result saved in `items.tsv`, or `not checked yet` when none is saved. A task or where item
with no check reads `no check · <age>`, and a wait with no check reads `<who> · <age>`. A blocked
task reads `blocked by <id>` while that id is open, followed by ` · <result>` when it has a check.
When a row of `items.tsv` does not parse, `www` still prints the rows that do, and names the broken
row on stderr. See [the brief design](../design/wherewerewe/brief.md) for the layout.
