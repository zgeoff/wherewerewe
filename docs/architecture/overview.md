# Overview

`wherewerewe` keeps the notes of one long coding agent session, and prints them back as one short
brief when the agent runs `www`. It has the store, the writes, approvals, the grant, decisions, the
three history reads, `show`, `log` and `recap`, the import of a hand-kept store and the upgrade of a
format 1 store, the owner's notes and the brief. A command it does not have exits 2. Read this
before you change the package, then open the design doc that the section you change links.

## The package

The `@wherewerewe/cli` package in `packages/cli/` installs two commands, `www` and `wherewerewe`,
that run the same file. Agents and people type `www`, because it is short. A script or a hook calls
`wherewerewe`, because no other common tool uses that name.

The package ships its TypeScript source, and Bun runs it, so the repo has no build step.
`ts-pattern` is its only runtime dependency.

## The store

Each session keeps its state in one folder of plain text files under `$XDG_STATE_HOME/wherewerewe/`,
or under `~/.local/state/wherewerewe/` when that is unset. `session` holds the goal, the grant with
one line per bullet, and the item in focus, `items.tsv` the open items, `notes.tsv` one row for each
open item that has a note, `owner.tsv` the owner's notes that still show, and `journal.tsv` every
write. `init` and `import` create `owner.tsv`, and only `say` and `ack` rewrite it. A note write and
the close of an item with a note rewrite `notes.tsv`, and a missing `notes.tsv` reads as no notes. A
session never reuses a closed id: a write reads from the journal the ids that `done`, `drop` and
`use` closed, the decision numbers, who made each decision and, for `say`, the highest note number
among its `say` rows, and nothing else from the journal. The store is format 2. Every command except
`import`, `sessions` and `help` exits 5 on a format 1 store, and `www import` upgrades it in place:
it keeps the format 1 files in `format-1-backup/`, writes `session` last, and reads the backup on a
rerun. See [the store design](../design/wherewerewe/store.md) for the formats.

A write takes the folder's `lock` file, appends its journal rows, rewrites `items.tsv`, `notes.tsv`
and `session` through a temporary file and a rename, and removes the lock, and a write that changes
no note leaves `notes.tsv` alone. The journal comes first, so a write that stops half way leaves a
close recorded and its item still open, never an item gone with no record. A writer wins the claim
file named after the lock and reads the lock again before it removes that lock, its own or a stale
one, so one writer is inside at a time as long as each write finishes within the stale age in the
store design, measured on the wall clock. A write that runs longer can lose the lock to the next
writer, and so can a write during which the clock jumps forward by more than that age.

## Finding the session

A command finds its session from `--session`, then `WHEREWEREWE_SESSION`, then the binding of the
agent session id in `CLAUDE_CODE_SESSION_ID`, or in `CODEX_SESSION_ID`, or `CODEX_THREAD_ID` when
that is unset. An empty id, or one with a character a file name cannot hold, counts as unset. `init`
and `attach` write a binding file under `.bindings/`, and `detach` removes it. With no match the
command exits 4, and never falls back to the only session on the machine. See
[sessions and hooks](../design/wherewerewe/sessions-and-hooks.md).

## Commands and refusals

This version has `help`, `sessions`, `init`, `attach`, `detach`, `goal`, `now`, `task`, `wait`,
`rule`, `where`, `set`, `ok`, `grant`, `decide`, `done`, `drop`, `use`, `show`, `log`, `recap`,
`import`, `say` and `ack`, and `www` alone prints the brief. A write answers in one line, except
`now` and a close, which print the note of an item that has one. The reply of a write, such as
`task`, `done`, `decide`, `say` or `ack`, names the item or note and ends with the brief's length;
`init`, `attach`, `detach` and `import` say what they did, and `import` names the folder of the
backup. Each refusal prints its text and a `Run:` line with the command that fixes it. See
[the commands design](../design/wherewerewe/commands.md) for the replies and the refusals.

`now` and every item write take `--note` and `--owed`, and `set` also takes `--no-note` and no
claim. A note holds up to 400 characters, an item has at most one, and `--owed` marks a note that
must be dealt with before the item closes. `now` and each close print the note whole, and `done`,
`drop` and `use` refuse while the note is owed.

## Approvals and decisions

See [the commands design](../design/wherewerewe/commands.md) for the flags and replies, and
[the store design](../design/wherewerewe/store.md) for the rows each writes.

`ok` writes a one-time approval as an item that keeps the owner's exact words as its claim, with who
gave them, where and what they cover. The brief holds one, so a second `ok` refuses until the first
is spent. `use` spends it: it leaves `items.tsv` and stays in the journal with what the agent did
with it. `ok --standing` is refused, because lasting permission lives in the grant.

`grant` sets the owner's words as bullets, one `--may`, `--not` or `--never` flag per bullet, with
an optional `--scope`, `--where` for where the owner gave them and `--reading` for the agent's
reading of what they cover. `--reading` alone replaces the reading of the grant the session holds.
Any shell can run it, and its journal row has `by=owner` when the terminal test of the owner notes
passes and `by=agent` otherwise. A `grant` that sets the words needs at least one bullet in any
group. A bullet has no limit of its own once each line break becomes a space: the bullets and scope
together take 700 characters in at most 12 bullets, and the bullets take at most 19 lines of the
brief. The scope takes 40, the reading 200 and `--where` 16.

`decide` writes a decision, or with `--ruled-out` an approach that lost, as a journal row and no
item. The tool numbers it `d-<n>`, one past the highest decision in the journal. A decision made by
the owner can be replaced only by a decision recorded with `--who owner`.

## Owner notes

`say` and `ack` run only when stdin and stdout are terminals and none of `CLAUDECODE`,
`CLAUDE_CODE_SESSION_ID`, `CODEX_SESSION_ID`, `CODEX_THREAD_ID` or `CODEX_CI` has a value. A
variable with an empty value counts as unset. `cli.ts` reads the two descriptors once and passes the
answer in, and `run-cli.ts` checks both conditions right after the arguments parse, before it finds
the session.

In an agent shell the command exits 3 and the agent records what the owner said as a rule, a wait,
an approval or the grant instead. The check catches an agent that writes a note by mistake. An agent
that fakes a terminal and clears the variables passes it. See
[the owner notes design](../design/wherewerewe/owner-notes.md) for what the conditions leave open.

`say` numbers a note `o-<n>`, one past the highest `o-<n>` among the journal's `say` rows and the
notes that show, so an acknowledged note's number is never reused. `say` and `ack` take the store
lock, append their journal row, and then replace `owner.tsv` through a temporary file and a rename.
A stop between the two leaves a `say` that never shows and uses up its number, or an `ack` whose
note still shows until the next `ack`. No other command rewrites `owner.tsv`.

The brief shows at most 2 notes, oldest first, right after the grant, until `ack` clears them. A row
of `owner.tsv` that does not parse is left out of the brief and named on stderr, and `say` and `ack`
refuse until the owner fixes the file. Every other write works as before. See
[the store design](../design/wherewerewe/store.md) for the file format.

The owner reads `www --session <name> recap` to check what the session kept, and corrects it with
`say`.

## Reading the journal

See [the commands design](../design/wherewerewe/commands.md) for the filters and replies, and
[the store design](../design/wherewerewe/store.md) for the journal format.

`show <id>` prints one open item, closed item or decision, with the decisions made about it and its
last 10 journal rows. `show` with no id lists every open task in full and reads no journal. `log`
prints the journal oldest first, kept to the rows that `--since`, `--op` and `--id` name, and sorts
them by time. `recap` prints one screen for the owner: the grant as the brief prints it, the notes
on open items, and the decisions and closes since `--since`, which defaults to `24h`. Each section
has a row limit and an overflow line, whose command prints the rest, and the whole screen is at most
55 lines. Each line is at most 100 characters, except the two overflow lines that repeat a `--since`
value longer than 7 characters, which stay whole so their commands run. `show <id>`, `log` and
`recap` read the journal in chunks and hold only the rows they need, take no lock, run no check and
write nothing. Once the session is found and its store is format 2, none is refused for a missing or
unreadable thing: an unknown id lists the open items, and an unreadable journal prints the item or
the recap without its history and says so on stderr. Only a `--since` that `log` or `recap` cannot
read exits 2.

## Importing a hand-kept store

`www import <session>` converts a session folder whose `session` file has `format=0-by-hand`, or has
no `format` line, to format 2 in place. It takes the grant's flags, folds an approval that the
hand-kept store marks `standing` into the grant, and creates `notes.tsv`. It takes the session's
lock, reads the three hand-kept files, and checks every row against the write rules. When any row
breaks a rule, it exits 3 with one line per row and changes no file. See
[the store design](../design/wherewerewe/store.md) for the conversion and
[the commands design](../design/wherewerewe/commands.md) for the refusal text.

Otherwise, when an agent session runs the import, the import takes the lock in `.bindings/` that
every binding change takes, so a busy lock converts nothing. It copies `session`, `items.tsv` and
`journal.tsv` into `import-backup/` through a temporary folder and a rename, so `import-backup/` is
either absent or complete. It writes each new file in full to a temporary file, and renames them
into place in this order: `owner.tsv`, `prs.tsv`, `notes.tsv`, `items.tsv`, `journal.tsv` and
`session`, and writes the binding last, so a stopped import never leaves the agent bound to a
hand-kept store. A store whose `session` file still has `format=0-by-hand` has not finished
importing. A rerun reads the originals from `import-backup/` when it exists, removes any
`import-backup.tmp-*` folder and any temporary file a stopped import staged, and converts the store
again. The backup and each new file keep the permissions of the file they replace, and a new
`owner.tsv` or `prs.tsv` takes those of `session`.

A rerun refuses a store that is format 2 already. When an agent session runs it, the refusal's
`Run:` line is `www attach <session>`, which binds an agent that an import left unbound by stopping
after its last rename and before its binding.

An item that a hand-kept `done`, `closed`, `drop` or `use` journal row closes leaves `items.tsv`. A
hand-kept journal settles a question or an item with a `closed` row. A question cannot reuse a
closed id. An item holds only the `extra` keys of its kind: `where` and `scope` on an approval,
`blocked_by` on a task, `who` on a wait or an approval. A refusal never prints a value that looks
like a credential.

## Upgrading a format 1 store

`www import <session>` on a store whose `session` file says `format=1` upgrades it to format 2 in
place, under the same locks. It refuses, and changes nothing, when the store holds a standing
approval and the command has no `--may`, when it holds more than one one-time approval, or when it
holds an item with the id `grant`. One refusal holds every problem it finds with one `Run:` line. A
standing approval folds into the grant that the grant's flags give, and `--drop` repeats once for
each item that goes. The upgrade copies the format 1 files into `format-1-backup/` through a
temporary folder and a rename, writes `journal.tsv`, `items.tsv`, `notes.tsv` and `session` in that
order, and binds the agent last. A stop before the backup's rename leaves the format 1 store as it
was, with no `format-1-backup/`, and a rerun reads the live files. A later stop leaves `session` at
`format=1` with a whole backup, which a rerun reads in place of the live files, or at `format=2`
with every file written. See [the store design](../design/wherewerewe/store.md) for the conversion
table.

## The brief

`www` prints the goal, the grant, the item in focus with its note, and the open tasks, waits, the
one-time approval, rules and where items, in the budget of the agent that reads it: at most 82 lines
and 9,000 characters for Claude Code, and 73 lines and 7,200 characters for Codex and for a reader
with no known host. The host comes from the reader's environment, `CLAUDE_CODE_SESSION_ID` for
Claude Code and `CODEX_SESSION_ID` or `CODEX_THREAD_ID` for Codex, never from the store. The open
tasks print in the order of the brief design, as many as fit, and a count line names `www show`,
which lists the rest. The grant prints whole after the goal and is never cut. Its bullets sit under
`may`, `not` and `never`: each `may` and `not` bullet takes a line of its own, and short `never`
bullets share a line. Only the note of the item in focus prints, and every item with an owed note is
tagged `owed`. The goal, each grant bullet, the reading and the note wrap at 100 columns by the rule
in the brief design, at most 3 changed rows and 1 pull request row show, and the footer is one line.

The brief runs no check: an item with a check shows the last result saved in `items.tsv`, or
`not checked yet` when none is saved. A task or where item with no check reads `no check · <age>`,
and a wait with no check reads `<who> · <age>`. A blocked task reads `blocked by <id>` while that id
is open, followed by ` · <result>` when it has a check. When a row of `items.tsv` does not parse,
`www` still prints the rows that do, and names the broken row on stderr. See
[the brief design](../design/wherewerewe/brief.md) for the layout.
