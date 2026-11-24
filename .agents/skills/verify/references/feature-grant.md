# grant

Check that a format 1 store upgrades to format 2 with the owner's words as its grant, and that the
grant can be read and replaced. A user whose store holds two standing approvals runs
`www import <session>`, is refused, runs the command with the owner's words, and reads the grant in
the brief and in `show`. The journey runs the real `www` as a process, with its home and state
folders inside the run's folder under `.wringer/`, so it never touches your own stores.
`seed-format-1` copies an invented format 1 store into the run as the session `trial-grant`.

## Journey

Run `bun verify up --restart` first, so `trial-grant` does not exist yet, then `doctor`.

Give the `refuse` line's `--run` the `Run:` line as `www` prints it, and leave its two placeholders
as they are.

```bash
bun verify use --feature grant
bun verify www seed-format-1
bun verify www refuse --line 'www import trial-grant' --expect 'www: refused: trial-grant holds 2 standing approvals' --run "www import trial-grant --quote \"<the owner's words, whole>\" --where chat --reading \"<what they cover; what the owner kept back>\""
bun verify www run --line 'www import trial-grant --quote "Merge the garden-api pull requests yourself once CI is green and every review finding is answered. Deploy to the staging beds whenever you need to, and wipe or reseed the staging sensor table as often as you like. Never touch the production beds or the production sensor table, and never publish a release of the garden-api package." --where chat --reading "covers garden-api merges on green CI with findings answered, and staging deploys and reseeds; kept back: production beds, production sensor table, releases"' --expect 'Upgraded trial-grant to format 2: grant 332 of 700 characters, 2 standing approvals folded into it, 1 one-time approval kept. Originals in '
bun verify www run --line 'www --session trial-grant' --expect 'GRANT  from the owner in chat, 0m ago'
bun verify www run --line 'www --session trial-grant grant --reading "covers garden-api merges and staging deploys only; kept back: everything in production and every release"' --expect 'grant reading: 104 of 200. Brief: '
bun verify www run --line 'www --session trial-grant show grant' --expect '  reading (0m): covers garden-api merges and staging deploys only'
```

## End state

- `bun verify www seed-format-1` exits 0 with `data.folder` under the run's folder.
- `bun verify www refuse` exits 0: `www` refused the bare import with exit 3, because the store
  holds two standing approvals and no grant, and printed the `Run:` line that adds `--quote`,
  `--where` and `--reading`.
- Each `bun verify www run` exits 0, and its `data.stdout` holds the `--expect` text: the upgrade
  reports a grant of 332 characters, two standing approvals folded into it and one one-time approval
  kept, the brief opens the grant with where the owner said it and how long ago, replacing the
  reading reports its length out of 200, and `show grant` prints the new reading. Each fails with
  `check-failed` when `www` exits other than 0 or prints other text.
- When a command fails, follow its row in [Exit codes](exit-codes.md) (step 4 of
  [Check a change](../SKILL.md#check-a-change)). When the end state does not match, follow step 5 of
  Check a change.
