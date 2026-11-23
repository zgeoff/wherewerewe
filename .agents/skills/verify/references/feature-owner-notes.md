# owner-notes

Check that the owner can write and clear a note from a terminal, that the brief shows it first after
the goal, and that an agent cannot write one. The journey starts a session and a task with the real
`www`, then runs `say` and `ack` through the terminal driver, which gives `www` a terminal with no
agent variables, and reads the brief between them. Its folders are inside the run's folder under
`.wringer/`, so it never touches your own stores.

## Journey

Run `bun verify up --restart` first, so no `trial-owner` session exists, then `doctor`.

```bash
bun verify use --feature owner-notes
bun verify www run --line 'www init trial-owner --goal "Ship the glaze timer in the pottery app"' --expect 'Started session trial-owner in '
bun verify www run --line 'www --session trial-owner task t-timer "Write the glaze timer"' --expect 't-timer  task, open, no check. Brief: '
bun verify www refuse --line 'www --session trial-owner say "A note from an agent shell"' --expect 'www: refused: only the owner writes owner notes' --run 'www --session trial-owner rule <id> "<what the owner said, as a rule>"'
bun verify terminal start say-as-agent
bun verify terminal wait --session say-as-agent-1 --text 'www: refused: only the owner writes owner notes'
bun verify terminal stop --session say-as-agent-1
bun verify terminal start say-first
bun verify terminal wait --session say-first-1 --text 'o-1  owner note. It tops the brief until you run: www --session trial-owner ack o-1'
bun verify terminal stop --session say-first-1
bun verify www run --line 'www --session trial-owner' --expect 'OWNER SAYS (1) · act on it; only the owner clears it'
bun verify terminal start say-second
bun verify terminal wait --session say-second-1 --text 'o-2  owner note on t-timer. It tops the brief until you run: www --session trial-owner ack o-2'
bun verify terminal stop --session say-second-1
bun verify terminal start say-third
bun verify terminal wait --session say-third-1 --text 'www: refused: 2 owner notes already show. Clear one that is done.'
bun verify terminal wait --session say-third-1 --text 'Run: www --session trial-owner ack o-1'
bun verify terminal stop --session say-third-1
bun verify terminal start ack-first
bun verify terminal wait --session ack-first-1 --text 'o-1  cleared. Kept in the journal.'
bun verify terminal stop --session ack-first-1
bun verify www run --line 'www --session trial-owner' --expect 'OWNER SAYS (1) · act on it; only the owner clears it'
bun verify www run --line 'www --session trial-owner' --expect '  o-2  Use the recorded kiln readings in the timer tests  [on t-timer · '
```

## End state

- Each `bun verify www run` exits 0, and its `data.stdout` holds the `--expect` text: the session
  and the task exist, the brief shows one note after the first `say`, and after `ack o-1` it shows
  one note again, `o-2`, where it showed two. Each fails with `check-failed` when `www` exits other
  than 0 or prints other text.
- `bun verify www refuse` exits 0: `www` run with no terminal refused `say` with exit 3 and the
  `Run:` line that records the owner's words as a rule.
- Each `bun verify terminal wait` exits 0 with the text on the screen. `terminal stop` reports
  `data.exitCode` 3 for `say-as-agent` and `say-third`, which `www` refused, and 0 for `say-first`,
  `say-second` and `ack-first`.
- When a command fails, follow its row in [Exit codes](exit-codes.md) (step 4 of
  [Check a change](../SKILL.md#check-a-change)). When the end state does not match, follow step 5 of
  Check a change.
