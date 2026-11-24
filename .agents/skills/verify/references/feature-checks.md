# checks

Check that a claim an item holds is checked against the world, and that the brief says when it stops
being true. A user starts a session, gives a work tree item a `--path` check, reads the brief, and
removes the path. The brief then prints a `CHANGED SINCE WRITTEN` row with the command that fixes
it, and the user runs that command. The journey runs the real `www` as a process, with its home and
state folders inside the run's folder under `.wringer/`, and with a `PATH` that holds `git` and no
`gh`, so it never touches your own stores or the network.

## Journey

Run `bun verify up --restart` first, so `trial-checks` does not exist, then `doctor`.

```bash
bun verify use --feature checks
bun verify www run --line 'www init trial-checks --goal "Ship the dock map in the bike-share app"' --expect 'Started session trial-checks in '
bun verify www make-path --name dock-map
bun verify www run --line 'www --session trial-checks where wt-dock "dock map worktree, branch dock-map" --path {run}/paths/dock-map' --expect 'wt-dock  where, open, checked now: clean.'
bun verify www run --host codex --line 'www --session trial-checks' --expect '  wt-dock     dock map worktree, branch dock-map  [clean]'
bun verify www remove-path --name dock-map
bun verify www run --host codex --line 'www --session trial-checks' --expect 'CHANGED SINCE WRITTEN (1) · these claims are no longer true'
bun verify www run --host claude --line 'www --session trial-checks' --expect ' · now missing · run: www drop wt-dock --why "path missing, seen by check"'
bun verify www run --line 'www --session trial-checks drop wt-dock --why "path missing, seen by check"' --expect 'wt-dock  dropped.'
bun verify www run --line 'www --session trial-checks log --op changed' --expect 'clean -> missing'
bun verify www run --host codex --line 'www --session trial-checks' --expect 'NOW  none. Run: www now <id> "<next step>"'
```

## End state

- Each `bun verify www run` exits 0, and its `data.stdout` holds the `--expect` text. The path reads
  `clean` at the write and in the brief. Once the path is gone, the brief prints the `CHANGED` row
  with the fix command, the `log` keeps the `changed` row, and the fix command closes the item.
- The run's folder sits under `.wringer/`, which `.gitignore` lists, so the path check's
  `git status` prints nothing and the path reads `clean`.
- The journey adds `--session trial-checks` to the fix command, because a journey runs with no
  binding. The command is otherwise as printed.
- No expected text holds an age, which is real time.
- When a command fails, follow its row in [Exit codes](exit-codes.md) (step 4 of
  [Check a change](../SKILL.md#check-a-change)). When the end state does not match, follow step 5 of
  Check a change.
