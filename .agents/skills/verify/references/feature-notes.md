# notes

Check that an agent can write rows in `www` and read them back in the brief. A user starts a
session, writes a task, changes it, has a wait refused for its missing `--who`, writes the wait and
a next step, reads the brief, and closes the task. The journey runs the real `www` as a process,
with its home and state folders inside the run's folder under `.wringer/`, so it never touches your
own stores.

## Journey

Run `bun verify up --restart` first, so `trial-notes` does not exist yet, then `doctor`.

```bash
bun verify use --feature notes
bun verify www run --line 'www init trial-notes --goal "Ship the parser with its tests"' --expect '{"ok":true,"session":"trial-notes","bound":false}'
bun verify www run --line 'www --session trial-notes task "Write the parser"' --expect '{"ok":true,"id":"task-1","label":"task"}'
bun verify www run --line 'www --session trial-notes set task-1 "Parser reads its flags; tests pass" --note "Covers the in and out flags"' --expect '{"ok":true,"id":"task-1"}'
bun verify www refuse --line 'www --session trial-notes wait "Review of the parser PR"' --expect 'a wait names who you wait on'
bun verify www run --line 'www --session trial-notes wait "Review of the parser PR" --who dana' --expect '{"ok":true,"id":"wait-1","label":"wait"}'
bun verify www run --line 'www --session trial-notes now "Open the parser PR"' --expect '{"ok":true,"id":"now","label":"now"}'
bun verify www run --line 'www --session trial-notes' --expect 'trial-notes · 4 open rows · last write 0m ago'
bun verify www run --line 'www --session trial-notes' --expect 'WAIT   wait-1  Review of the parser PR [dana]'
bun verify www run --line 'www --session trial-notes' --expect 'TASK   task-1  Parser reads its flags; tests pass'
bun verify www run --line 'www --session trial-notes done task-1 --evidence "commit 4c1d2e0"' --expect '{"ok":true,"id":"task-1","closed":"done"}'
bun verify www run --line 'www --session trial-notes' --expect 'trial-notes · 3 open rows'
```

## End state

- Each `bun verify www run` exits 0, and its `data.stdout` holds the `--expect` text. Each write
  answers with one JSON line that holds the row's id. The brief counts four open rows, which are the
  goal, the task, the wait and the next step, and prints the wait with who it is on and the task
  with its new text. After `done`, the brief counts three.
- `bun verify www refuse` exits 0: `www` refused the wait with no `--who`, exit 2, and its stderr
  holds the reason.
- When a command fails, follow its row in [Exit codes](exit-codes.md) (step 4 of
  [Check a change](../SKILL.md#check-a-change)). When the end state does not match, follow step 5 of
  Check a change.
