# 0008: Notes, the grant, and no caution steering

- Date: 2026-11-24
- Status: decided

## Decision

- **Notes.** An open item carries at most one note of up to 400 characters, written with `--note` in the same command as its claim or next step, and replaced by the next note. The brief prints only the note of the item in focus. `www now <id>`, each close and `www show <id>` print an item's note whole. An owed note (`--owed`) tags its item in the brief, and `done`, `drop` and `use` refuse while it stands. The owner reads what the session kept with `www recap`, one screen of at most 54 lines, and corrects it with `www say`.
- **The grant.** A session holds one grant: the owner's words, up to 700 characters in at most 12 bullets under `may`, `not` and `never`, with an optional scope, and the agent's reading of what they cover and what the owner kept back, up to 200 characters. It lives in `session`, like the goal, and the brief prints it whole directly after `GOAL`, each `may` and `not` bullet on a line of its own and short `never` bullets sharing a line. Standing approvals fold into it, and the store moves to format 2. One-time approvals stay, with a cap of 1.
- **No caution steering.** The tool prints no heading, label, reply, refusal or reminder that tells the agent to hold back, to ask, or to act only inside a limit. It keeps every rule that prevents a wrong fact: length limits, caps, refusals that print a working command, and the owed note.

## Why

- The agent reads what the brief puts in front of it and skips what it has to remember to look for. On the first day of real use, it rewrote a 120-character next step twice and lost the reason behind the step, which is what it needed after the compaction.
- The owner's failure case is an agent that, after a compaction, forgets what it was allowed, and stops to ask or loops waiting. A separate permission check already polices what the agent does ([README](../design/wherewerewe/README.md)), and it remembers the owner's messages better than the agent does. So the tool's job is to keep what the agent may do fresh in what it reads.
- The owner's real grant for the build session is 645 characters with about ten parts. Three approvals of 120 characters, each with a 40-character scope, under a heading that said "act only inside each quote and scope", cut it into fragments, and a fresh agent asked to do a task that no fragment named found no line that allowed it.
- The owner reads 700 characters wrapped into one quote as a wall of text, and approved one bullet per permission under `may`, `not` and `never`. The bullets cost up to 10 lines more than a quote; Codex's token count is the limit that matters, and the worst case stays under it.
- The owner cannot correct a note the owner cannot see. `www recap` puts the grant, the reading and every note in one screen, and `www say` puts the correction at the top of the next brief.

## Rejected alternatives

| Option                                                                 | Why not                                                                                                   |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| up to 2 notes of 200 characters, on tasks only, printed when the task is touched | an approval or a rule can carry no detail, and the grant has nowhere to go                     |
| up to 6 notes of 160 characters per item, the 2 newest on the item in focus printed | recency stands in for relevance: a new note pushes out an older one that still matters, and a note with no `--on` lands on whatever is in focus |
| up to 2 notes of 200 characters per item, each with its own `n-<k>` id, settled one by one with `done` or `drop` | a second id space, and closing an item means closing its notes first; the owed flag on a single note keeps the part that blocks a close |
| no new feature: detail goes into a handoff doc or plan file that a rule names | the agent reads the file only when it remembers the rule, which is the failure the tool exists to stop, and the file has no cap |
| keep standing approvals with a longer quote                            | several quotes still split one grant into fragments, and each counts against the approval cap           |
| the grant as a 400-character note on an approval                       | too short for the real grant, and printed only while the approval is in focus, which it never is        |
| the grant as one quote of up to 700 characters, wrapped                | the owner reads it as a wall of text, and finds no one permission in it at a glance                      |
| the grant in a file that a rule names                                  | the same remember-to-look failure, and the brief shows only the rule that names the file                            |
| `ok --standing` as the way to set the grant                            | one command with two shapes: an item with an id, a 120-character quote and a cap, and a session field with 700 characters and a reading |
| a grant heading that says to ask only for what the grant leaves out    | a line that tells the agent when to ask is the caution this decision removes                              |

## Consequences

- The brief's bound is 73 lines and 7,200 characters, 2,400 tokens at 3 characters per token, 4% under Codex's 2,500 ([brief.md](../design/wherewerewe/brief.md)). Changed rows drop from 4 to 3, pull request rows from 3 to 1, and the footer from 3 lines to 1, to pay for the grant and the note.
- A format 1 store exits 5 until `www import` upgrades it ([store.md](../design/wherewerewe/store.md)). The upgrade takes the grant in the same command when the store holds standing approvals, so every brief shows the approvals or the grant.
- The owner catches a wrong reading or a stale note by reading `www recap`. An owner who never runs it sees only what the brief shows.
- These printed strings change:
  - The brief's approvals heading, `APPROVED (<n> of 3) · act only inside each quote and scope`, becomes `APPROVED ONCE (<n> of 1)`.
  - The refusal of `use` on a standing approval, which ended "Act inside its quote and scope.", goes with standing approvals.
  - The refusal of `--replaces` on the owner's decision, "Ask the owner, and record the answer with --who owner.", becomes "d-4 is the owner's decision, so only a decision recorded with --who owner replaces it."
  - The refusal of `ok` without a part drops "and --once or --standing", and `www help` drops `(--once | --standing)` and "a --once approval".
  - The refusal of `say` and `ack` from an agent shell names the grant among the places the agent records what the owner said.
  - The refusal of a text over its limit, "the story belongs in a PR or a commit", points at the note.
  - The brief's example owner note, "Ask me first.", becomes a correction of the grant's reading.
  - The grant's heading is `GRANT  from the owner in <where>, <age> ago`, then the owner's scope, with no instruction, and its labels `may`, `not` and `never` state what the owner said.
- These printed strings stay, because each prevents a wrong fact or states one: `OWNER SAYS (<n>) · act on it; only the owner clears it`, `CHANGED SINCE WRITTEN (<n>) · these claims are no longer true`, the credential refusal, the evidence refusal of `done`, and every `Run:` line.
