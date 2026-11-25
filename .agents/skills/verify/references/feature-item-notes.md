# item-notes

Check that an agent can keep a note on an item, read it when it turns to the item, and cannot close
the item while the note is owed. A user starts a session, writes a task with an owed note, puts it
in focus, reads the note in the brief and in `show`, has the close refused, clears the note with the
refusal's `Run:` line, closes the task, and reads the note rows in the journal. The journey runs the
real `www` as a process, with its home and state folders inside the run's folder under `.wringer/`,
so it never touches your own stores.

## Journey

Run `bun verify up --restart` first, so `trial-item-notes` does not exist, then `doctor`.

```bash
bun verify use --feature item-notes
bun verify www run --line 'www init trial-item-notes --goal "Ship the glaze timer in the pottery app"' --expect 'Started session trial-item-notes in '
bun verify www run --line 'www --session trial-item-notes task t-kiln "Wire the kiln sensor to the glaze timer" --note "Switch the kiln simulator off before this closes: the studio shares it on Fridays." --owed' --expect 't-kiln  task, open, no check, note 82 of 400, owed. Brief: 173 of 20000 tokens.'
bun verify www run --line 'www --session trial-item-notes' --expect ' · owed]'
bun verify www run --line 'www --session trial-item-notes now t-kiln "Read the sensor range from its spec sheet"' --expect 'now: t-kiln, with its owed note ('
bun verify www run --line 'www --session trial-item-notes' --expect '    Switch the kiln simulator off before this closes: the studio shares it on Fridays.'
bun verify www run --line 'www --session trial-item-notes show t-kiln' --expect '  owed note ('
bun verify www refuse --line 'www --session trial-item-notes done t-kiln --evidence "commit 4c1d2e0"' --expect 'www: refused: t-kiln has an owed note (' --run 'www --session trial-item-notes set t-kiln --no-note'
bun verify www refuse --line 'www --session trial-item-notes done t-kiln --evidence "commit 4c1d2e0"' --expect 'www: refused: t-kiln has an owed note (' --run 'www --session trial-item-notes set t-kiln --note "<detail>"  # nothing was written'
bun verify www run --line 'www --session trial-item-notes set t-kiln --no-note' --expect 't-kiln  note cleared. Brief: 181 of 20000 tokens.'
bun verify www run --line 'www --session trial-item-notes done t-kiln --evidence "commit 4c1d2e0"' --expect 't-kiln  done. Off the brief, kept in the journal. Brief: 140 of 20000 tokens.'
bun verify www run --line 'www --session trial-item-notes log --op note --id t-kiln' --expect 'owed: Switch the kiln simulator off'
bun verify www run --line 'www --session trial-item-notes log --op note --id t-kiln' --expect 'note cleared'
bun verify www run --line 'www --session trial-item-notes' --expect 'NOW  none. Run: www now <id> "<next step>"'
```

## End state

- Each `bun verify www run` exits 0, and its `data.stdout` holds the `--expect` text: the task's
  reply counts its note and marks it owed, the brief tags the task owed before and after it is in
  focus and prints the note under `NOW` once it is, `show` prints the owed note, clearing the note
  reports the brief's estimated tokens with no line for the note, closing the task keeps it in the
  journal, and the journal shows the owed note and its clearing. Each fails with `check-failed` when
  `www` exits other than 0 or prints other text.
- `bun verify www refuse` exits 0: `www` refused `done` while the note was owed, with exit 3, and
  printed two `Run:` lines. One check reads the first, which clears the note. The other reads the
  last, which replaces the note and ends with the comment that says nothing was written.
- When a command fails, follow its row in [Exit codes](exit-codes.md) (step 4 of
  [Check a change](../SKILL.md#check-a-change)). When the end state does not match, follow step 5 of
  Check a change.
