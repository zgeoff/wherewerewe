# hooks

Check that `www install` writes the hook entries, the allow rules and the skill, and that the hooks
of a bound session answer as the gate says, on each host. A user installs, starts a session in a
host's shell, gets compacted, and tries a tool call before and after reading the brief. The journey
pipes each hook payload into the real `www hook <host>` as a process, and runs `www install` against
the run's own home. Its home and state folders sit inside the run's folder under `.wringer/`, so the
journey never touches your own settings or stores.

## Journey

Run `bun verify up --restart` first, so `trial-hooks` does not exist, then `doctor`.

```bash
bun verify use --feature hooks
bun verify www run --line 'www install --human' --expect '/home/.claude/settings.json: written'
bun verify www run --line 'www doctor --human' --expect '/home/.codex/hooks.json: already set'
bun verify www run --host claude --line 'www init trial-hooks --goal "Ship the dock map"' --expect '{"ok":true,"session":"trial-hooks","bound":true}'
bun verify www hook --harness claude --empty --payload '{"session_id":"ffff-unbound","hook_event_name":"SessionStart","source":"startup"}'
bun verify www hook --harness claude --empty --payload '{"session_id":"ffff-unbound","hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{"command":"ls"}}'
bun verify www hook --harness claude --expect 'wherewerewe: this session keeps its notes in trial-hooks. Run: www' --payload '{"session_id":"verify-host","hook_event_name":"SessionStart","source":"compact"}'
bun verify www hook --harness claude --expect 'this session started or was compacted' --payload '{"session_id":"verify-host","hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{"command":"ls"}}'
bun verify www hook --harness claude --expect 'this session started or was compacted' --payload '{"session_id":"verify-host","hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{"command":"www rows"}}'
bun verify www hook --harness claude --empty --payload '{"session_id":"verify-host","agent_id":"sub-1","hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{"command":"ls"}}'
bun verify www hook --harness claude --empty --payload '{"session_id":"verify-host","hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{"command":"www"}}'
bun verify www hook --harness claude --empty --payload '{"session_id":"verify-host","hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{"command":"ls"}}'
bun verify www run --host codex --line 'www attach trial-hooks' --expect '{"ok":true,"session":"trial-hooks"}'
bun verify www hook --harness codex --expect 'wherewerewe: this session keeps its notes in trial-hooks. Run: www' --payload '{"session_id":"verify-host","hook_event_name":"SessionStart","source":"startup"}'
bun verify www hook --harness codex --expect 'pass max_output_tokens 10000' --payload '{"session_id":"verify-host","hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{"command":"ls"}}'
bun verify www hook --harness codex --empty --payload '{"session_id":"verify-host","hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{"command":"www"}}'
bun verify www hook --harness codex --empty --payload '{"session_id":"verify-host","hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{"command":"ls"}}'
```

## End state

- `www install` against the run's home writes the two Claude Code and two Codex hook entries, the
  allow rules, the Codex rules file and the `www` skill for each host, all under the run's folder.
  `www doctor` then exits 0.
- Each `bun verify www hook` exits 0, and its `data.stdout` holds the `--expect` text or is empty.
- A session id with no binding gets no output from either event.
- After a `SessionStart`, the hook refuses `ls` and `www rows` with the reason's first line, lets a
  subagent's call through, and lets bare `www` through. After bare `www`, it lets `ls` through.
- The Codex refusal adds the hint to pass `max_output_tokens 10000`.
- The run's folder sits under `.wringer/`, which is in `.gitignore`.
- When a command fails, follow its row in [Exit codes](exit-codes.md) (step 4 of
  [Check a change](../SKILL.md#check-a-change)). When the end state does not match, follow step 5 of
  Check a change.
