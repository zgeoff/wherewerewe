# 0021: A refused write says on its last Run line that it wrote nothing

- Date: 2026-11-25
- Status: decided

## Decision

The last `Run:` line of a refusal of any command other than the five reads, `www sessions`, `www help` and `www goal --paste` ends with two spaces and `# nothing was written`. A shell reads `#` there as the start of a comment, so the line still runs as printed. The reason lines are unchanged. An unknown command gets the comment, and when a refusal prints two `Run:` lines, only the last gets it.

## Why

- Agents using the tool read a refused write as if it had happened, and one brief stayed stale for five hours.
- An agent that reads only the last line of a refusal sees the fix and not the fact that nothing changed. Putting the fact on that line puts it where the agent reads.
- A sentence such as "Nothing was written." before the `Run:` line leaves the last line holding only the fix.
- A comment after the command keeps the line one that runs as printed.

## Rejected alternatives

| Option | Why not |
| --- | --- |
| end the reason line with "Nothing was written." | the last line, the one an agent reads, holds only the fix |
| a third line after the `Run:` line | the last line is then no `Run:` line, which breaks the rule that a refusal ends with one |
| a comment on every refusal, reads included | a refused read leaves nothing to say, and the comment would claim a write that never happened |

## Consequences

- A refused write changes nothing ([commands.md](../design/wherewerewe/commands.md#constraints)), so every exit code takes the comment.
- Before it prints a `Run:` line, `www` fills and parses it without the comment, so its parser never reads `#` and the words after it as arguments. A test strips only that exact suffix, so a `#` inside a quoted value stays a word.
- The printed form of each refusal is in [commands.md](../design/wherewerewe/commands.md#refusals).
