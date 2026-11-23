# help

Check that `www help` prints the help text. A user runs `www help`, or `www` with no command, to see
the commands. The journey runs the real `www help` as a process, with its home and state folders
inside the run's folder under `.wringer/` so it never touches your own stores, and compares the
first line it prints.

## Journey

Start a run first: steps 2 and 3 of [Check a change](../SKILL.md#check-a-change) run `up` and
`doctor`.

```bash
bun verify use --feature help
bun verify www help --first-line "www (wherewerewe): what is true now in one long agent session, in one short brief."
```

## End state

- The journey's `bun verify www help --first-line ...` exits 0, and `data.firstLine` is
  `www (wherewerewe): what is true now in one long agent session, in one short brief.`. It exits 1
  with `check-failed` when `www` exits other than 0 or prints another first line. When a command
  fails, follow its row in [Exit codes](exit-codes.md) (step 4 of
  [Check a change](../SKILL.md#check-a-change)). When the end state does not match, follow step 5 of
  Check a change.
