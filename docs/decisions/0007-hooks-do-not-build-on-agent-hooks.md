# 0007: The hooks do not build on agent-hooks

- Date: 2026-11-23
- Status: proposed

## Decision

wherewerewe parses Claude Code and Codex hook input itself, in one small parser per agent, and writes its own entries into the user's hook settings. It does not depend on `@zgeoff/agent-hooks`.

## Why

- `@zgeoff/agent-hooks` installs per repo, through a start-up stub in the repo that runs `bun install` when the package is missing. wherewerewe installs once per machine, in user settings.
- Its handlers are a fixed list inside the package, with no way to add one from outside.
- Its parser handles tool events only, and sets no session id for Claude Code; wherewerewe needs `SessionStart`, `SubagentStart` and `session_id` from both agents.

## Rejected alternatives

| Option                                            | Why not                                                                                       |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| add a wherewerewe handler to `@zgeoff/agent-hooks` | it would run only in repos set up with that package, and tie a public tool to one owner's repos |
| depend on its parser                              | the parser is not exported, and lacks the events and the session id                           |

## Consequences

- The two parsers follow the same split by harness as `@zgeoff/agent-hooks`, and its rule that `install` keeps every other hook.
- A change in either agent's hook input is fixed in this repo.
