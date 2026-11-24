# grant

Check that a format 1 store upgrades to format 2 with the owner's words as its grant, in bullets
under `may`, `not` and `never`, and that the grant can be read and replaced, as a grant of one `not`
bullet, with a bullet that wraps, or refused for lacking any bullet. A user whose store holds two
standing approvals runs `www import <session>`, is refused, runs the command with the owner's words
as bullets, and reads the grant in the brief and in `show`. The real `www` runs as a process, with
its home and state folders inside the run's folder under `.wringer/`, so it never touches your own
stores. `seed-format-1` copies an invented format 1 store into the run as the session `trial-grant`.

## Journey

Run `bun verify up --restart` first, so `trial-grant` does not exist yet, then `doctor`.

Give the `refuse` line's `--run` the `Run:` line as `www` prints it, and leave its placeholders as
they are: `www refuse` compares the `Run:` line that `www` prints with it.

```bash
bun verify use --feature grant
bun verify www seed-format-1
bun verify www refuse --line 'www import trial-grant' --expect 'www: refused: trial-grant holds 2 standing approvals' --run "www import trial-grant --may \"<what the owner allows, in their words>\" --may \"<what the owner allows, in their words>\" --where chat --reading \"<what they cover; what the owner kept back>\""
bun verify www run --line 'www import trial-grant --may "merge the garden-api pull requests once CI is green and every review finding is answered" --may "deploy to the staging beds whenever you need to" --may "wipe or reseed the staging sensor table" --not "anything in the production sensor table" --never "touch the production beds" --never "publish a garden-api release" --scope "in garden-api and the staging beds" --where chat --reading "covers garden-api merges on green CI with findings answered, and staging deploys and reseeds; kept back: production beds, production sensor table, releases"' --expect 'Upgraded trial-grant to format 2: grant 300 of 700 characters, 2 standing approvals folded into it, 1 one-time approval kept. Originals in '
bun verify www run --host codex --line 'www --session trial-grant' --expect '  never  • touch the production beds  • publish a garden-api release'
bun verify www run --line 'www --session trial-grant grant --reading "covers garden-api merges and staging deploys only; kept back: everything in production and every release"' --expect 'grant reading: 104 of 200. Brief: '
bun verify www run --line 'www --session trial-grant show grant' --expect ': covers garden-api merges and staging deploys only'
bun verify www run --line 'www --session trial-grant grant --not "replant the north beds before the soil report is in" --where chat --reading "covers nothing yet; kept back: replanting the north beds until the soil report is in"' --expect 'grant: 51 of 700 characters in 1 of 12 bullets on 1 of 19 lines, reading 84 of 200. Brief: '
bun verify www run --host codex --line 'www --session trial-grant' --expect '  not    • replant the north beds before the soil report is in'
bun verify www run --host claude --line 'www --session trial-grant' --expect '  not    • replant the north beds before the soil report is in'
bun verify www run --line 'www --session trial-grant show grant' --expect '  not    • replant the north beds before the soil report is in'
bun verify www run --line 'www --session trial-grant grant --may "merge the garden-api pull requests yourself once CI is green, every review finding is answered, and the staging beds have run the new build for a full day" --not "replant the north beds before the soil report is in" --where chat --reading "covers garden-api merges after a day on the staging beds; kept back: replanting the north beds"' --expect 'grant: 205 of 700 characters in 2 of 12 bullets on 3 of 19 lines, reading 94 of 200. Brief: '
bun verify www run --host codex --line 'www --session trial-grant' --expect '           answered, and the staging beds have run the new build for a full day'
bun verify www refuse --line 'www --session trial-grant grant --scope "in garden-api" --where chat --reading "covers nothing yet"' --expect 'www: refused: a grant needs at least one --may, --not or --never' --run "www --session trial-grant grant --scope \"in garden-api\" --where chat --reading \"covers nothing yet\" --may \"<what the owner allows, in their words>\""
```

## End state

- `bun verify www seed-format-1` exits 0 with `data.folder` under the run's folder.
- `bun verify www refuse` exits 0: `www` refused the bare import with exit 3, because the store
  holds two standing approvals and no grant, and printed the `Run:` line that adds `--may`,
  `--where` and `--reading`.
- Each `bun verify www run` exits 0, and its `data.stdout` holds the `--expect` text: the upgrade
  reports a grant of 300 characters, two standing approvals folded into it and one one-time approval
  kept, the brief prints the two `never` bullets on one line, replacing the reading reports its
  length out of 200, and `show grant` prints the new reading. A grant of one `not` bullet prints
  under both hosts and in `show grant`, and a bullet of 154 characters prints whole on two lines.
  Each fails with `check-failed` when `www` exits other than 0 or prints other text.
- The last `bun verify www refuse` exits 0: `www` refused a grant with no bullet and printed the
  `Run:` line that adds `--may`.
- When a command fails, follow its row in [Exit codes](exit-codes.md) (step 4 of
  [Check a change](../SKILL.md#check-a-change)). When the end state does not match, follow step 5 of
  Check a change.
