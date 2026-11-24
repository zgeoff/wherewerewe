# 0011: A grant of limits, and its lines

- Date: 2026-11-24
- Status: decided

## Decision

A grant holds at least one bullet in any of `may`, `not` and `never`. It holds at most 12 bullets, which take at most 19 lines of the brief, and at most 700 characters of words; no bullet has a limit of its own.

## Why

- An owner may give only a limit and allow nothing yet. Refusing that grant left the brief saying the session had no grant, a wrong fact that [0008](0008-notes-the-grant-and-no-caution-steering.md) forbids.
- The owner decided that the brief's size bounds the grant. A per-bullet cap of 120 forced a sentence of 162 characters to be split.
- 19 lines is the line count the worst case already pays for, so each budget keeps its lines and no task row goes. The 12 bullets stay because they bound the `never` bullets that share a line, which add characters and no line.

## Rejected alternatives

| Option | Why not |
| --- | --- |
| keep `--may` required | refuses an owner who gave only a limit |
| a `--may` placeholder in every `Run:` line | puts a limit's words under `may` |
| no per-bullet limit and 12 bullets with no line limit | 20 lines, one task row fewer in each host's worst case |
| no per-bullet limit and 10 bullets | fewer than 12 bullets, which already made the builder merge two |
| a line limit with no bullet count | 342 one-character `never` bullets fill 19 lines with 1,843 characters, over the Codex budget |
| 19 lines and 19 bullets | 7,213 characters by the bound, over 7,200 |
| a per-bullet limit of 164 | a per-line cap again, 2 characters above one sentence |
| a higher line limit | each line costs a task row in each worst case |

## Consequences

- These printed strings change: the text of the refusal for a grant with no bullet; the refusal for a grant over 19 lines, beside the 12-bullet refusal, and the over-120 refusal gone; the grant reply's `on <l> of 19 lines`; the help's `www grant [--may …]`, `Grant:` and `Limits:` lines.
- The 120-character bullet of [0008](0008-notes-the-grant-and-no-caution-steering.md) no longer holds.
- The `www` of `5fdaa5e`, the task-cap merge before this change, and every older one refuse a store whose grant has no `may` bullet or has a bullet over 120 characters. The store stays format 2.
