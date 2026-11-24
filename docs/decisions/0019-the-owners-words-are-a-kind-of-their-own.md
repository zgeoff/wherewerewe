# 0019: The owner's own words are a kind of their own

- Date: 2026-11-25
- Status: decided

## Decision

The owner's words are a kind of their own: the owner's exact words, at most 300 characters, with where they were said. They have their own file, `words.tsv`, their own command, `www words`, and their own brief section, `WORDS`, with a cap of 8. The agent copies them whole and never paraphrases them. They permit nothing, are never spent, and close with `drop` only. The store stays at format 2.

## Why

- The agent's paraphrase in a rule or a lesson loses what the owner meant, and the grant holds only permissions.
- The owner's own words shape every choice, and the agent cannot rebuild them from a summary.

## Rejected alternatives

| Option | Why not |
| --- | --- |
| more owner notes | only the owner can write them, from a terminal, and the agent must act on each |
| a longer grant | it mixes taste with permission |
| the approval quote | one use spends it |

## Consequences

- The brief cuts the owner's words only after every never-cut line, and with the caps in force the cut reaches them on no host.
