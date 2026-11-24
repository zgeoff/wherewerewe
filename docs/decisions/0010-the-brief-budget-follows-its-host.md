# 0010: The brief's budget follows its host

- Date: 2026-11-24
- Status: decided

## Decision

The brief's size limit follows the host that reads it: 82 lines and 9,000 characters for Claude Code, and 73 lines and 7,200 characters for Codex and for a reader with no known host. The host comes from the reader's environment, never from the store.

## Why

- The owner decided that a Claude Code session's brief may have a limit of its own, apart from Codex's.
- Each budget sits under its host's limit on hook output put into context, with a margin. Codex puts about 2,500 tokens into context. Claude Code puts 10,000 characters, and past that only a 2,000-character preview ([hooks](https://code.claude.com/docs/en/hooks)).
- One session can be bound to both hosts at once, so only the reader's environment says which host reads the brief. With no known host, the smaller budget fits either agent.

## Rejected alternatives

| Option | Why not |
| --- | --- |
| one budget for both hosts | the Codex budget wastes 1,800 characters a Claude Code session can read, and a Claude Code budget pushes a Codex brief past its token limit |
| a Claude Code budget of the full 10,000 characters | no margin for a character Claude Code counts as 2 that the brief counts as 1, and passing the cap costs a 2,000-character preview |
| the host from the newest `bind` journal row | a session can hold bindings for both hosts, and the brief reads no journal |
| the host as a new `session` key | a format change |

## Consequences

- A Claude Code session's brief and write replies count up to 82 lines. Decision record 0008's "73 lines and 7,200 characters" holds for Codex and for a reader with no known host.
