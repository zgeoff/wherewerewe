# 0020: Authority comes from the owner's own acts: an allow rule the owner installs and a /goal the owner pastes

- Date: 2026-11-25
- Status: decided

## Decision

Authority comes from the owner's own acts. `www install` writes an allow rule for `www` into Claude Code's user settings and into a rules file of its own for Codex, under the owner's sign-off. `www goal --paste` prints a `/goal` text of the grant, and the owner pastes it. Injected context authorises nothing, and the tool never writes `classifierContext`.

## Why

- Scripted Claude Code sessions in auto mode, each given a standing permission in one place, then a compaction, then the permitted action, gave these counts of the classifier's allows and blocks:

| Where the permission was | Allowed | Blocked |
| --- | --- | --- |
| no permission given (control) | 0 | 6 of 6 |
| a user message before any compaction (control) | 3 of 3 | 0 |
| the compaction summary, which restated it | 2 of 2 | 0 |
| the user's original message, with a summary that left it out | 0 | 2 of 2 |
| the command text of a tool call | 0 | 4 of 4 |
| a `/goal` condition, after a compaction | 0 | 2 of 2 |
| a `/goal` condition, before any compaction | 1 of 1 | 0 |
| `SessionStart` hook context | 0 | 2 of 2 |

- The classifier kept a permission across a compaction only when the compaction summary restated it, so injected context cannot carry one.
- Without an allow rule, the first `www` asks the owner in Manual mode, and a headless run refuses it, so the gate opens with no brief.

## Rejected alternatives

| Option | Why not |
| --- | --- |
| rely on injected context to authorise anything | the finding above rules it out |
| print settings lines for the owner to paste | the owner judged it not useful |

## Consequences

- The Codex rule takes every `www` call out of the Codex sandbox, and Codex marks rules experimental, so a later Codex version can change or drop them. `www doctor` checks the rule.
- The owner's paste carries authority before a compaction, and after one only when the agent's summary restates the grant.
