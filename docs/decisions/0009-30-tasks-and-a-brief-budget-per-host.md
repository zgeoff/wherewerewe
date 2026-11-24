# 0009: 30 tasks and a brief budget per host

- Date: 2026-11-24
- Status: decided

## Decision

A session holds up to 30 open tasks. The wait, rule, where and one-time approval caps stay. The store stays in format 2.

The brief's size limit follows the host that reads it: 82 lines and 9,000 characters for Claude Code, and 73 lines and 7,200 characters for Codex and for a reader with no known host. The brief prints, in a fixed order, as many task rows as fit in that budget, and one line that counts the rest and names `www show`. `www show` with no id lists every open task in full.

## Why

- The owner found a cap of 6 open tasks too small for a long session, and expects an agent on a long task to hold about 20.
- The owner decided that a Claude Code session's brief may have a limit of its own, apart from Codex's.
- Each budget sits under its host's limit on hook output put into context, with a margin. Codex puts about 2,500 tokens into context. Claude Code puts 10,000 characters, and past that only a 2,000-character preview ([hooks](https://code.claude.com/docs/en/hooks)).
- The host comes from the reader's environment, because one session can be bound to both hosts at once. With no known host, the smaller budget fits either agent.
- The order puts first what the agent acts on: the item in focus, a claim that is no longer true, work that waits on something or owes a note, then the newest.
- 30 leaves half again of room over 20, and a limit still bounds three things: `items.tsv` and `notes.tsv` stay the same size on day 14 as on day 2 (at most 44 open items and 44 notes), every count the brief and the recap print stays at 2 digits, and the number of probes a read starts stays within what finishes in 5 s.

## Rejected alternatives

| Option | Why not |
| --- | --- |
| no limit | the store files stop being capped, the counts lose their digit bound, and checked tasks pass what the probes finish in 5 s |
| keep 6 | too small for the work the owner runs |
| print every task in the brief | 30 rows of 196 characters pass 7,200 on their own |
| cut each task row to 100 characters to fit more | lines bind first, and the brief never cuts a line |
| a fixed 5 task rows | leaves 26 lines idle on a brief like the day-9 example |
| `www show tasks` | `tasks` is a valid item id |
| `www log --op task` | prints journal rows, closed tasks and rewrites included |
| a new subcommand | adds a word where `www show` with no id needs none |
| raise every cap | the owner named tasks, and each other cap keeps its own reason |
| one budget for both hosts | the Codex budget wastes 1,800 characters a Claude Code session can read, and a Claude Code budget pushes a Codex brief past its token limit |
| a Claude Code budget of the full 10,000 characters | no margin for a character Claude Code counts as 2 that the brief counts as 1, and passing the cap costs a 2,000-character preview |
| the host from the newest `bind` journal row | a session can hold bindings for both hosts, and the brief reads no journal |
| the host as a new `session` key | a format change |

## Consequences

- These printed strings change: the `OPEN` heading's cap, `OPEN (<n> of 30)`; the full-kind refusal, "the session holds"; the changed overflow line; the help's `www show [<id>]` lines and its `Limits:` line.
- A Claude Code session's brief and write replies count up to 82 lines. Decision record 0008's "73 lines and 7,200 characters" holds for Codex and for a reader with no known host.
- `notes.tsv` holds up to 44 rows.
- A read starts its probes in the order the brief prints rows, and a task whose probe did not run keeps its saved result, which still counts as changed.
