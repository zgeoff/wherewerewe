# 0013: After a compaction the hooks inject the goal and the grant, and gate until the agent reads the brief

- Date: 2026-11-25
- Status: decided

## Decision

After each start, resume and compaction of a bound agent session, the `SessionStart` hook puts the goal, the grant and the two lines of the refusal into context, and the agent runs `www` itself for the rest of the brief. The `PreToolUse` and `Stop` hooks refuse the agent's tool calls until a `PostToolUse` hook has seen the main agent read the brief whole. The hooks never write `classifierContext`, and the injected text authorises nothing.

## Why

- The agent reads its state by its own act, and a hook checks that it did. The brief's length then stops depending on how much hook output a host puts into context.
- A refused call works. In Claude Code, the first call after a refused batch was `www` in 6 of 6 runs. With the `SessionStart` line alone, the model ran `www` first in 4 of 9 starts and resumes, and the gate refused the first call in the other 5.
- Codex's default of about 2,500 tokens for hook output is not a hard limit: a handler's `additionalContextLimit` raises it. Every Codex claim about the gate rests on the Codex docs until a real Codex session proves it, because Codex runs a project hook only after a person trusts it.
- The injection serves the agent's memory and nothing else. Scripted Claude Code sessions in auto mode, each given a standing permission in one place, then a compaction, then the permitted action, gave these counts of the classifier's allows and blocks:

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

- In auto mode the classifier kept a permission across a compaction only when the compaction summary restated it. With the owner's words in front of it after every compaction, the agent can restate them accurately in its next summary. The owner's own paste of the text from `www goal --paste` carries authority before a compaction, and after one only when the agent's summary restates the grant.

## Rejected alternatives

| Option | Why not |
| --- | --- |
| inject the whole brief from `SessionStart` | every size limit in the tool then follows a host's injection limit, which left the brief 7 characters of room |
| a `Stop` hook alone | the agent can work a whole turn after a compaction before it tries to stop, and that turn is where it forgets what it may do |
| `www` sets the flag itself | a piped read and a subagent's read each opened the main agent's gate |
| the `SessionStart` line alone | the model followed it in 4 of 9 starts and resumes |
| a `UserPromptSubmit` gate | it never fires on an automatic compaction in the middle of a turn |
| one brief shared across machines or sessions | out of scope: the tool serves a single long-running orchestrator, and sharing would widen who can write the store |

## Consequences

- This record replaces the earlier design's injection of the whole brief, which no record held.
- It replaces the consequence of [0004](0004-hooks-install-once-per-machine.md) that every Bash call in every session on the machine starts the hook. `PreToolUse` now starts on every tool call that reaches a hook, and hosted tools such as web search never do, so they can run before the brief is read. `PreToolUse` and `Stop` read at most the binding and the gate file, and return in under 150 ms.
