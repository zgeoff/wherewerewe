# recap

Check that the owner can read one screen of what a session kept, and correct it from what it prints.
A user starts a session, writes a grant, two items with a note and one without, closes an item with
its evidence, records six decisions, and runs `www recap`. The recap prints the grant in bullets,
both notes with the owed one first, the item with no note, the close with its evidence, and five of
the six decisions with an overflow line. The user runs the overflow line's command and reads the
sixth decision. The journey runs the real `www` as a process, with its home and state folders inside
the run's folder under `.wringer/`, so it never touches your own stores.

## Journey

Run `bun verify up --restart` first, so `trial-recap` does not exist, then `doctor`.

```bash
bun verify use --feature recap
bun verify www run --line 'www init trial-recap --goal "Ship the dock map in the bike-share app"' --expect 'Started session trial-recap in '
bun verify www run --line 'www --session trial-recap grant --may "merge the dock map PRs once CI is green" --may "deploy the map to staging whenever you need to" --not "changing the pricing screen" --never "the prod rider database" --scope "in the dock map repo" --where chat --reading "covers dock map merges on green CI and staging deploys; kept back: pricing screen, prod rider database"' --expect 'grant: 155 of 700 characters in 4 of 12 bullets, reading 102 of 200.'
bun verify www run --line 'www --session trial-recap task t-dock "Draw the docks on the map" --note "The dock feed sends lat and lng swapped for the old stations; swap them back in the parser."' --expect 't-dock  task, open, no check, note 91 of 400.'
bun verify www run --line 'www --session trial-recap task t-flag "Turn on the dock_map flag in staging" --note "Turn the dock_map flag off in staging before this closes: QA shares it." --owed' --expect 't-flag  task, open, no check, note 71 of 400, owed.'
bun verify www run --line 'www --session trial-recap rule r-tests "Run the map tests from app/; from the repo root they are skipped"' --expect 'r-tests  rule, open.'
bun verify www run --line 'www --session trial-recap task t-icons "Add dock icons to the map"' --expect 't-icons  task, open, no check.'
bun verify www run --line 'www --session trial-recap done t-icons --evidence "commit 7d2e4a1"' --expect 't-icons  done.'
bun verify www run --line 'www --session trial-recap decide "Cluster docks below zoom 12" --why "Single pins overlap downtown"' --expect 'd-1  decision.'
bun verify www run --line 'www --session trial-recap decide "Cache the dock feed for 30 s" --why "The feed rate-limits at 2 calls a second"' --expect 'd-2  decision.'
bun verify www run --line 'www --session trial-recap decide "Show empty docks in grey" --why "Riders asked for it in the beta"' --expect 'd-3  decision.'
bun verify www run --line 'www --session trial-recap decide "Poll the feed every second" --why "It hits the rate limit" --ruled-out' --expect 'd-4  ruled out.'
bun verify www run --line 'www --session trial-recap decide "Draw docks with the map SDK markers" --why "Custom markers drop frames on old phones"' --expect 'd-5  decision.'
bun verify www run --line 'www --session trial-recap decide "Hide docks closed for repair" --why "A closed dock sends riders to a dead end"' --expect 'd-6  decision.'
bun verify www run --line 'www --session trial-recap recap' --expect '  may    • merge the dock map PRs once CI is green'
bun verify www run --line 'www --session trial-recap recap' --expect 'NOTES (2 of 2 open items with a note) · owed first, then newest'
bun verify www run --line 'www --session trial-recap recap' --expect $'  t-flag      Turn on the dock_map flag in staging\n    owed note ('
bun verify www run --line 'www --session trial-recap recap' --expect $'QA shares it.\n  t-dock      Draw the docks on the map\n    note ('
bun verify www run --line 'www --session trial-recap recap' --expect '): The dock feed sends lat and lng swapped for the old stations; swap them back in the …'
bun verify www run --line 'www --session trial-recap recap' --expect '  no note: r-tests'
bun verify www run --line 'www --session trial-recap recap' --expect '  t-icons     done · commit 7d2e4a1'
bun verify www run --line 'www --session trial-recap recap' --expect $'  d-1  Cluster docks below zoom 12 · why: Single pins overlap downtown\n  d-2  Cache the dock feed for 30 s · why: The feed rate-limits at 2 calls a second\n  d-3  Show empty docks in grey · why: Riders asked for it in the beta\n  d-4  ruled out: Poll the feed every second · why: It hits the rate limit\n  d-5  Draw docks with the map SDK markers · why: Custom markers drop frames on old phones\n  and 1 more: www --session trial-recap log --op decide,ruled-out --since 24h'
bun verify www run --line 'www --session trial-recap log --op decide,ruled-out --since 24h' --expect 'Hide docks closed for repair'
bun verify www run --line 'www --session trial-recap recap' --expect 'Correct: www --session trial-recap say "<text>" [--on <id>]'
bun verify www run --line 'www --session trial-recap show t-dock' --expect 'Draw the docks on the map'
```

## End state

- Each `bun verify www run` exits 0, and its `data.stdout` holds the `--expect` text: the recap
  prints the grant in bullets, the notes heading, then both items with their notes in order, the
  owed one first and the other cut at 100 characters, the item with no note, the close with its
  evidence, the five oldest decisions in order with an overflow line for the sixth, and the footer's
  `say` command. The overflow line's command prints the sixth decision, and `show` prints the item
  whose note the recap cut. Each fails with `check-failed` when `www` exits other than 0 or prints
  other text.
- The 4 counts in the replies are code points: 155 for the bullets and scope, 102 for the reading,
  91 and 71 for the notes.
- No expected text holds a note's age, which is real time: a slow run prints `1m` where a fast one
  prints `0m`. An expected text that spans lines is a `$'…'` word, with `\n` for each line break.
- When a command fails, follow its row in [Exit codes](exit-codes.md) (step 4 of
  [Check a change](../SKILL.md#check-a-change)). When the end state does not match, follow step 5 of
  Check a change.
