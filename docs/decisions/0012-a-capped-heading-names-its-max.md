# 0012: A capped heading names its max

- Date: 2026-11-24
- Status: decided

## Decision

A section of a capped kind prints its heading as `(<n>, max <cap>)`, where `<n>` counts the open items of that kind. The recap's `NOTES` heading prints `(<m> on <o> open items)`.

## Why

- An agent read `OPEN (4 of 6)`, `WAITING (2 of 4)` and `RULES (3 of 5)` as a part of a total, and could not tell whether the second number was a limit.
- `max` names the number as a limit in one word. It adds 2 characters to each of the five capped headings, and the Codex worst case stays 7 characters under its budget by the bound.

## Rejected alternatives

| Option | Why not |
| --- | --- |
| `(<n>/<cap>)` | a ratio, as ambiguous as `of` |
| `(<n>, limit <cap>)` | 7,203 characters by the bound, over the Codex budget by 3 |
| a heading that counts the rows printed | the count line already does |

## Consequences

- This record replaces the heading `OPEN (<n> of 30)` from [0009](0009-30-open-tasks-and-a-count-of-the-rest.md) with `OPEN (<n>, max 30)`.
- The headings `OPEN`, `WAITING`, `APPROVED ONCE`, `RULES` and `WHERE` change, and so does the recap's `NOTES`. `OWNER SAYS (<n>)` keeps its form, as [0008](0008-notes-the-grant-and-no-caution-steering.md) keeps it.
