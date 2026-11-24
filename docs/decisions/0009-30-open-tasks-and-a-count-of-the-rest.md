# 0009: 30 open tasks and a count of the rest

- Date: 2026-11-24
- Status: decided

## Decision

A session holds up to 30 open tasks. The wait, rule, where and one-time approval caps stay. The store stays in format 2.

The brief prints, in a fixed order, as many task rows as fit in its budget, and one line that counts the rest and names `www show`. `www show` with no id lists every open task in full.

## Why

- The owner found a cap of 6 open tasks too small for a long session, and expects an agent on a long task to hold about 20.
- The order puts first what the agent acts on: the item in focus, a claim that is no longer true, work that waits on something or owes a note, then the newest.
- 30 leaves half again of room over 20, and a limit still bounds three things: `items.tsv` and `notes.tsv` stay the same size on day 14 as on day 2 (at most 44 open items and 44 notes), every count the brief and the recap print stays at 2 digits, and each probe is one more a read must start. A read starts its probes in the order the brief prints rows and keeps each saved result, so a probe that does not finish in 5 s leaves its task with the result it had.

## Rejected alternatives

| Option | Why not |
| --- | --- |
| no limit | the store files stop being capped, the counts lose their digit bound, and most checked tasks would read `unchecked` when the read stops waiting at 5 s |
| keep 6 | too small for the work the owner runs |
| print every task in the brief | 30 rows leave too little room for the other sections |
| cut each task row to 100 characters to fit more | lines bind first, and the brief never cuts a line |
| a fixed 5 task rows | leaves 26 lines idle on a brief like the day-9 example |
| `www show tasks` | `tasks` is a valid item id |
| `www log --op task` | prints journal rows, closed tasks and rewrites included |
| a new subcommand | adds a word where `www show` with no id needs none |
| raise every cap | the owner named tasks, and each other cap keeps its own reason |

## Consequences

- These printed strings change: the `OPEN` heading's cap, `OPEN (<n> of 30)`; the full-kind refusal, "the session holds"; the changed overflow line; the help's `www show [<id>]` lines and its `Limits:` line.
- `notes.tsv` holds up to 44 rows.
- A read starts its probes in the order the brief prints rows, and a task whose probe did not run keeps its saved result, which still counts as changed.
