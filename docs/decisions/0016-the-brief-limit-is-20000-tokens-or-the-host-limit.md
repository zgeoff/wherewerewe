# 0016: The brief's limit is 20,000 estimated tokens or the host's shell output limit, whichever is smaller

- Date: 2026-11-25
- Status: decided

## Decision

The brief's limit is 20,000 estimated tokens or the host's shell output limit, whichever is smaller, with no host setting changed. An estimated token is 3 UTF-8 bytes, rounded up. The tool holds each limit in bytes, 20% under the measured limit and rounded down: 24,000 bytes for Claude Code, 30,000 for Codex, and 60,000 for a reader with no known host. The host comes from the reader's environment.

## Why

- The owner set the rule, and the measured limits fix the figures. Claude Code returns 30,000 characters of shell output whole, and a file path with a 2,000-character preview at 31,000. Codex returns 39,000 bytes whole when the call's `max_output_tokens` is 10,000 or absent, and cuts the middle past that.
- The estimate undercounts on Claude Code, whose tokenizer ran about 1.35 times the estimate on a sample brief, and is close on Codex.

## Rejected alternatives

| Option | Why not |
| --- | --- |
| one low figure for both hosts | a long session's state is worth far more than a few thousand tokens, and what matters is which lines are cut |
| raise a host setting such as `bashOutputMaxChars` from `www install` | the owner's rule changes no setting, and the key also raises the inline output of every Bash call on the machine |

## Consequences

- This record replaces [0010](0010-the-brief-budget-follows-its-host.md), and the consequence of [0008](0008-notes-the-grant-and-no-caution-steering.md) that the brief's bound is 73 lines and 7,200 characters.
- Records [0009](0009-30-open-tasks-and-a-count-of-the-rest.md), [0011](0011-a-grant-of-limits-and-its-lines.md) and [0012](0012-a-capped-heading-names-its-max.md) stand. The "as many task rows as fit in its budget" of 0009 reads the new limit, and the budget reasons in 0011 and 0012 no longer bind their decisions.
