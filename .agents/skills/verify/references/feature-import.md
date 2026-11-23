# import

Check that `www import` converts a hand-kept store. A user who kept notes by hand runs
`www import <session>` once, then reads the brief. Run the journey to import an invented hand-kept
store with the real `www` and read its brief. It works on a copy in the run's folder under
`.wringer/`, so it never touches your own stores. `seed-hand-kept` copies the invented store into
the run as the session `trial-import`.

## Journey

Run `bun verify up --restart` first, so `trial-import` does not exist yet, then run `doctor`.

```bash
bun verify use --feature import
bun verify www seed-hand-kept
bun verify www run --line 'www import trial-import' --expect 'Imported trial-import: 7 items, 10 journal rows.'
bun verify www run --line 'www --session trial-import' --expect 'GOAL  Ship the kiln temperature alerts in the pottery app, behind the kiln_alerts flag.'
bun verify www run --line 'www --session trial-import' --expect '  q-1         Which kilns get alerts first  [owner · '
```

## End state

- `bun verify www seed-hand-kept` exits 0 with `data.folder` under the run's folder.
- Each `bun verify www run` exits 0, and its `data.stdout` holds the `--expect` text: the import
  reports 7 items and 10 journal rows, and the brief shows the goal and the open question `q-1` as a
  wait on the owner. Each fails with `check-failed` when `www` exits other than 0 or prints other
  text. When a command fails, follow its row in [Exit codes](exit-codes.md) (step 4 of
  [Check a change](../SKILL.md#check-a-change)). When the end state does not match, follow step 5 of
  Check a change.
