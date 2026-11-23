# 0004: Hooks install once per machine

- Date: 2026-11-23
- Status: decided

## Decision

`www install` puts three hook entries in the user's Claude Code and Codex settings, once for the machine. Each entry runs `wherewerewe hook claude` or `wherewerewe hook codex` for every session, and the hook does nothing for an agent session with no binding. A session opts in with `www init`, `www import` or `www attach`.

## Why

- One session works across several repos, so a hook installed per repo misses the repos it has not been set up in.
- An agent session that never runs `init` is untouched, so the owner's other agents see no change.
- One command for every event keeps the hook entry the same across versions, and Codex skips a hook whose entry changed until the owner trusts it again.

## Rejected alternatives

| Option                                | Why not                                                                                      |
| ------------------------------------- | -------------------------------------------------------------------------------------------- |
| hooks per repo                        | a session that moves to a repo with no hook loses its brief after the next compaction       |
| hooks the agent installs at `init`    | an agent would edit the owner's global settings, and Codex would need a new trust each time |
| no hooks, with an AGENTS.md line only | by day 9 the line has left the agent's context, and nothing brings the brief back           |

## Consequences

- Every Bash call in every session on the machine starts the hook, so an unbound hook must return in under 150 ms.
- Codex's sandbox needs the store root in `writable_roots`, an owner step.
