# hooks

Check that the hooks of a bound session answer as the gate says, on each host, and that
`www install` writes the hook entries, the allow rules and the skill. A user starts a session, binds
a host's session id to it, starts that session again, and tries a tool call before and after reading
the brief. The journey pipes each hook payload into the real `www hook <host>` as a process, and
runs `www install` against the run's own home, with its home and state folders inside the run's
folder under `.wringer/`, so it never touches your own settings or stores.

## Journey

Run `bun verify up --restart` first, so `trial-hooks` does not exist, then `doctor`.

```bash
bun verify use --feature hooks
bun verify www run --line 'www init trial-hooks --goal "Ship the dock map in the bike-share app"' --expect 'Started session trial-hooks in '
bun verify www hook --harness claude --empty --payload '{"session_id":"ffff-unbound","hook_event_name":"SessionStart","source":"startup"}'
bun verify www hook --harness claude --empty --payload '{"session_id":"ffff-unbound","hook_event_name":"PostToolUse","tool_name":"Bash","tool_input":{"command":"ls"},"tool_response":{"stdout":"a","exit_code":0}}'
bun verify www hook --harness claude --empty --payload '{"session_id":"9e1f-trial","hook_event_name":"PostToolUse","tool_name":"Bash","tool_input":{"command":"www attach trial-hooks"},"tool_response":{"stdout":"Attached","exit_code":0}}'
bun verify www hook --harness claude --expect 'GOAL  Ship the dock map in the bike-share app' --payload '{"session_id":"9e1f-trial","hook_event_name":"SessionStart","source":"startup"}'
bun verify www hook --harness claude --empty --payload '{"session_id":"9e1f-trial","hook_event_name":"PostToolUse","tool_name":"Bash","tool_input":{"command":"ls"},"tool_response":{"stdout":"a","exit_code":0}}'
bun verify www hook --harness codex --empty --payload '{"session_id":"ffff-unbound","hook_event_name":"SessionStart","source":"startup"}'
bun verify www hook --harness codex --empty --payload '{"session_id":"ffff-unbound","hook_event_name":"PostToolUse","tool_name":"Bash","tool_input":{"command":"ls"},"tool_response":"a"}'
bun verify www hook --harness codex --empty --payload '{"session_id":"9e1f-trial","hook_event_name":"PostToolUse","tool_name":"Bash","tool_input":{"command":"www attach trial-hooks"},"tool_response":"Attached"}'
bun verify www hook --harness codex --expect 'GOAL  Ship the dock map in the bike-share app' --payload '{"session_id":"9e1f-trial","hook_event_name":"SessionStart","source":"startup"}'
bun verify www hook --harness codex --empty --payload '{"session_id":"9e1f-trial","hook_event_name":"PostToolUse","tool_name":"Bash","tool_input":{"command":"ls"},"tool_response":"a"}'
bun verify www install --expect 'www install: adding "Bash(www *)" to permissions.allow in ~/.claude/settings.json'
bun verify www hook --harness claude --expect 'this session started or was compacted' --payload '{"session_id":"9e1f-trial","hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{"command":"ls"}}'
bun verify www hook --harness claude --empty --payload '{"session_id":"9e1f-trial","hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{"command":"www"}}'
bun verify www hook --harness claude --empty --payload '{"session_id":"9e1f-trial","hook_event_name":"PostToolUse","tool_name":"Bash","tool_input":{"command":"www"},"tool_response":{"stdout":"{brief:trial-hooks}","exit_code":0}}'
bun verify www hook --harness claude --empty --payload '{"session_id":"9e1f-trial","hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{"command":"ls"}}'
bun verify www hook --harness codex --expect 'this session started or was compacted' --payload '{"session_id":"9e1f-trial","hook_event_name":"SessionStart","source":"compact"}'
bun verify www hook --harness codex --expect 'this session started or was compacted' --payload '{"session_id":"9e1f-trial","hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{"command":"ls"}}'
bun verify www hook --harness codex --empty --payload '{"session_id":"9e1f-trial","hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{"command":"www"}}'
bun verify www hook --harness codex --empty --payload '{"session_id":"9e1f-trial","hook_event_name":"PostToolUse","tool_name":"Bash","tool_input":{"command":"www"},"tool_response":"{brief:trial-hooks}"}'
bun verify www hook --harness codex --empty --payload '{"session_id":"9e1f-trial","hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{"command":"ls"}}'
```

## End state

- Each `bun verify www hook` exits 0, and its `data.stdout` holds the `--expect` text or is empty.
  An unbound id gets no output from either event. A bound `SessionStart` prints the goal, and the
  first `ls` of a started session is refused with the reason's first line until the brief command
  and its whole output pass.
- `www install` against the run's home writes the six Claude Code and five Codex entries, the allow
  rule and rules file, and the `www` skill for each host, all under the run's folder.
- The run's folder sits under `.wringer/`, which `.gitignore` lists.
- The journey repeats the claude steps for codex with the codex payload shapes, because Codex's
  `tool_response` is a string.
- No expected text holds an age, which is real time.
- When a command fails, follow its row in [Exit codes](exit-codes.md) (step 4 of
  [Check a change](../SKILL.md#check-a-change)). When the end state does not match, follow step 5 of
  Check a change.
