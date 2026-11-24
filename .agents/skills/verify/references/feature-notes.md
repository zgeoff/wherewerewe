# notes

Check that an agent can keep its notes in `www` and read them back. A user starts a session, writes
a task, replaces its claim, has a close refused for its missing evidence, closes it, and reads the
brief. The journey runs the real `www` as a process, with its home and state folders inside the
run's folder under `.wringer/`, so it never touches your own stores.

## Journey

Run `bun verify up --restart` first, so `trial-notes` does not exist yet, then `doctor`.

```bash
bun verify use --feature notes
bun verify www run --line 'www init trial-notes --goal "Ship the parser with its tests"' --expect 'Started session trial-notes in '
bun verify www run --line 'www --session trial-notes task t-parser "Write the parser"' --expect 't-parser  task, open, no check. Brief: 6 lines.'
bun verify www run --line 'www --session trial-notes set t-parser "Parser reads its flags; tests pass"' --expect 't-parser  task, open, no check. Brief: 6 lines.'
bun verify www run --line 'www --session trial-notes' --expect '  t-parser    Parser reads its flags; tests pass  [no check · '
bun verify www refuse --line 'www --session trial-notes done t-parser' --expect 'www: refused: done needs evidence' --run 'www --session trial-notes done t-parser --evidence "<PR, commit or test run>"'
bun verify www run --line 'www --session trial-notes done t-parser --evidence "commit 4c1d2e0"' --expect 't-parser  done. Off the brief, kept in the journal. Brief: 4 lines.'
bun verify www run --line 'www --session trial-notes' --expect 'NOW  none. Run: www now <id> "<next step>"'
```

## End state

- Each `bun verify www run` exits 0, and its `data.stdout` holds the `--expect` text: the session
  starts, the task's reply reports a brief of 6 lines, the brief has the task with its new claim and
  no check, and after `done` the brief has no task and no item in focus. Each fails with
  `check-failed` when `www` exits other than 0 or prints other text. When a command fails, follow
  its row in [Exit codes](exit-codes.md) (step 4 of [Check a change](../SKILL.md#check-a-change)).
  When the end state does not match, follow step 5 of Check a change.
- `bun verify www refuse` exits 0: `www` refused `done` with no evidence, exit 3, and printed the
  `Run:` line with `--evidence` added.
