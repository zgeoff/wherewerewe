# 0018: A promise is a kind of its own, printed by the brief and the recap

- Date: 2026-11-25
- Status: decided

## Decision

A promise is something the agent owes someone, with who gets it and when: a text of at most 120 characters, `--to` of at most 16 and `--by` of at most 24. It has its own file, `promises.tsv`, its own command, `www promise`, and a cap of 5. The brief prints it as `PROMISED`, and `www recap` prints every promise. `done` closes a kept promise and `drop` closes one the agent will not keep. The store stays at format 2.

## Why

- A promise to a person has no check that would catch a miss, and the owner reads the recap.
- The agent does not act on a promise mid-run, so the brief cuts promises late in its order and the recap never cuts them.

## Rejected alternatives

| Option | Why not |
| --- | --- |
| a task with an owed note | it has no who and no when |
| a wait | a wait runs the other way: someone owes the agent |
| a promise kind in `items.tsv` | it needs a format change |

## Consequences

- The recap's bound is 61 lines, in place of the one screen of at most 54 lines in [0008](0008-notes-the-grant-and-no-caution-steering.md).
