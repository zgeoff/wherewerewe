# rows

Check that an agent can read its rows as JSON lines, for `jq` and `grep`. A user starts a session,
writes a decision, reads the open rows, drops the decision, and reads the whole history. The journey
runs the real `www` as a process, with its home and state folders inside the run's folder under
`.wringer/`, so it never touches your own stores.

## Journey

Run `bun verify up --restart` first, so `trial-rows` does not exist yet, then `doctor`.

```bash
bun verify use --feature rows
bun verify www run --line 'www init trial-rows --goal "Map the docks"' --expect '{"ok":true,"session":"trial-rows","bound":false}'
bun verify www run --line 'www --session trial-rows decide "Use the city dock feed" --why "It updates each minute"' --expect '{"ok":true,"id":"decision-1","label":"decision"}'
bun verify www run --line 'www --session trial-rows rows' --expect '{"id":"decision-1","label":"decision","text":"Use the city dock feed","note":"why: It updates each minute","by":"agent","at":"'
bun verify www run --line 'www --session trial-rows drop decision-1 --why "The feed closed"' --expect '{"ok":true,"id":"decision-1","closed":"dropped"}'
bun verify www run --line 'www --session trial-rows rows' --expect '{"id":"goal","label":"goal","text":"Map the docks","by":"agent","at":"'
bun verify www run --line 'www --session trial-rows rows --all' --expect '"how":"dropped","evidence":"The feed closed"}}'
```

## End state

- Each `bun verify www run` exits 0, and its `data.stdout` holds the `--expect` text.
- The first `rows` prints the decision as one JSON line, with its reason as the note.
- After `drop`, the `data.stdout` of `rows` is one line, the goal. `rows --all` prints three lines:
  the goal, the decision as written, and the decision again with `closed` set.
- When a command fails, follow its row in [Exit codes](exit-codes.md) (step 4 of
  [Check a change](../SKILL.md#check-a-change)). When the end state does not match, follow step 5 of
  Check a change.
