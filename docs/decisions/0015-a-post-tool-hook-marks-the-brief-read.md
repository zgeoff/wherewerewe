# 0015: A PostToolUse hook marks the brief read, and only on a whole read by the main agent

- Date: 2026-11-25
- Status: decided

## Decision

A `PostToolUse` hook writes `read` to the gate file when the main agent ran the brief command, the host reported success, the output starts with the bound session's header and ends with the brief's footer, the output holds no host truncation marker, and on Codex the call's `max_output_tokens` leaves room for the whole output. A subagent's read, where the payload carries `agent_id`, and a piped, filtered or redirected read never counts.

## Why

- The gate means the main agent saw the whole brief. `www` cannot tell that from the cases that break it.
- A piped read (`www | tail -1`) ran `www` whole while the agent saw one line. With `www` writing the flag, the gate opened.
- A subagent's shell carries the parent's session id, so a subagent's `www --session build` opened the parent's gate when `www` wrote the flag.
- With a `PostToolUse` hook writing the flag, neither read opened the gate, and the agent's own `www` did. The hook sees the command text, the output and `agent_id`, and `www` sees none of them.
- The footer check caught a brief over Claude Code's limit, whose `tool_response` held only the first 29,998 characters.

## Rejected alternatives

| Option | Why not |
| --- | --- |
| `www` writes the flag | a piped read and a subagent's read each opened the main agent's gate |
| `PreToolUse` writes `read` when it lets `www` through | a `www` that fails or is piped still counts |

## Consequences

- The brief's header start and its footer line are a contract between the renderer and the hook, pinned by a test.
- On Codex, the shape of `tool_response` for a shell call is unverified until a real Codex session records it.
- Codex documents `agent_id` on no tool event, so a Codex subagent's whole read counts like the main agent's. The cost is accepted: the subagent exists only after the parent's call passed the gate, and it reads the parent's own brief. A real Codex session records whether Codex sends `agent_id` on tool events, and when it does, this rule already covers it.
