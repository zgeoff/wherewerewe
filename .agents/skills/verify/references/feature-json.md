# json

Check that the brief and a list read as JSON, and that the grant prints as a `/goal` text. A user
starts a session, writes a rule, reads the brief and the list of rules as JSON, tries to print the
goal text before any grant exists, writes a grant and prints the text. The journey runs the real
`www` as a process, with its home and state folders inside the run's folder under `.wringer/`, so it
never touches your own stores or the network.

## Journey

Run `bun verify up --restart` first, so `trial-json` does not exist, then `doctor`.

```bash
bun verify use --feature json
bun verify www run --line 'www init trial-json --goal "Ship the tide chart in the sailing app"' --expect 'Started session trial-json in '
bun verify www run --line 'www --session trial-json rule r-units "Show depths in metres; the chart API sends feet"' --expect 'r-units  rule, open. Brief: '
bun verify www run --host codex --line 'www --session trial-json --json' --expect '"host":"codex","limit":{"bytes":30000,"tokens":10000},"estimate":'
bun verify www run --line 'www --session trial-json list rules --json' --expect '{"v":1,"kind":"rules","rows":[{"kind":"rule","row":{"id":"r-units","kind":"rule","claim":"Show depths in metres; the chart API sends feet","check":null,"atWrite":null,"last":null,"written":"'
bun verify www refuse --line 'www --session trial-json goal --paste' --expect 'www: refused: trial-json has no grant to print.' --run 'www --session trial-json grant --may "<what the owner allows, in their words>" --where <where> --reading "<what they cover; what the owner kept back>"'
bun verify www run --line 'www --session trial-json grant --may "merge the chart PRs once CI is green" --never "publish a release" --scope "in the sailing app" --where chat --reading "covers chart merges on green CI; kept back: releases"' --expect 'grant: '
bun verify www run --line 'www --session trial-json goal --paste' --expect '  may    • merge the chart PRs once CI is green'
bun verify www run --line 'www --session trial-json goal --paste' --expect 'Run www --session trial-json and deliver all the work in it.'
```

## End state

- Each `bun verify www run` exits 0 with its `--expect` text in `data.stdout`. The JSON brief names
  the Codex host and its limit, and the list prints the rule as JSON.
- `goal --paste` is refused before the grant, and prints the grant's bullet and its last line after
  it.
- The `refuse` line exits 3, and its `--run` text is the line `www` prints.
- The journey adds `--session trial-json` to each line, because a journey runs with no binding. The
  commands are otherwise as printed.
- No expected text holds an age, a time or a day number.
- When a command fails, follow its row in [Exit codes](exit-codes.md) (step 4 of
  [Check a change](../SKILL.md#check-a-change)). When the end state does not match, follow step 5 of
  Check a change.
