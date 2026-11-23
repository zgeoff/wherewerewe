# help

Check that `www help` prints the help text. A user runs `www help`, or `www` with no command, to see
the commands. The journey runs the real `www help` as a process, with its home and state folders
inside the run's folder under `.wringer/` so it never touches your own stores, and compares the
first line it prints.

## Journey

```bash
bun verify use --feature help
bun verify www help --first-line "wherewerewe (www): notes for one long agent session"
```

## End state

- `bun verify www help` exits 0, and `data.firstLine` is
  `wherewerewe (www): notes for one long agent session`. It exits 1 with `check-failed` when `www`
  exits other than 0 or prints another first line. When it fails, follow step 5 of
  [Check a change](../SKILL.md#check-a-change).
