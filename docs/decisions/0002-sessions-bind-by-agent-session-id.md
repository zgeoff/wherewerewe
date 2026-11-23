# 0002: Sessions bind by agent session id

- Date: 2026-11-23
- Status: proposed

## Decision

A command finds its wherewerewe session from `--session`, then `WHEREWEREWE_SESSION`, then a binding file keyed by the agent session id in its environment: `CLAUDE_CODE_SESSION_ID` for Claude Code, `CODEX_SESSION_ID` for Codex. A hook finds it from the `session_id` on its stdin. `init`, `import` and `attach` write the binding, and the hook also binds its own id when it sees one of those commands succeed. With no name, the command refuses.

## Why

- The owner runs several agent sessions on one machine, so a default session would send one agent's notes into another's store.
- Both agents put the session id into every shell command's environment, so the agent types no flag.
- A Claude Code subagent's shell carries the parent's id, so a subagent writes to the parent's store with no extra step.
- Binding from the hook covers an agent whose shell id and hook id differ.

## Rejected alternatives

| Option                                   | Why not                                                                                          |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------ |
| a machine-wide default session           | two sessions on one machine write to the same store                                              |
| the session found from the working folder | one session works across several repos and worktrees, and two sessions can share a repo         |
| `WHEREWEREWE_SESSION` alone              | the agent must remember it on every command after each compaction, and hooks cannot see it       |

## Consequences

- After `/clear`, or a resume or fork that changes the id, the agent or the owner runs `www attach <name>`.
- The owner names the session on each command from a terminal, with `--session`.
