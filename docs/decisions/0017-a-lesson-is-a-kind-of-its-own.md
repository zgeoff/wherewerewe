# 0017: A lesson is a kind of its own, in lessons.tsv

- Date: 2026-11-25
- Status: decided

## Decision

A lesson is an instruction of at most 120 characters with its reason, `--why`, of at most 200, learned from a mistake. It has its own file, `lessons.tsv`, its own command, `www lesson`, and its own brief section, `LESSONS`, with a cap of 5. It closes with `drop` only. The store stays at format 2.

## Why

- A lesson needs the mistake that taught it, which a 120-character rule cannot hold.
- A rule is how to work in this session, and a lesson guards against one mistake that already happened here.

## Rejected alternatives

| Option | Why not |
| --- | --- |
| a rule with a longer text | it breaks the 120-character claim |
| the reason as the item's note | a note prints only for the item in focus |
| a lesson kind in `items.tsv` | `extra` cannot hold `;` or `=` in a reason, and the kind needs a format change |

## Consequences

- An older tool ignores `lessons.tsv` and still reads the store.
