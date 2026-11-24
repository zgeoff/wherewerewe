# new-kinds

Check that an agent can keep a lesson, a promise and the owner's words in `www`, read them back, and
close each with the command that fits its kind. A user starts a session, writes a rule, a lesson, a
promise and a piece of the owner's words, reads the brief under both hosts, lists the rules, reads
the recap, has `done` refused on the lesson, keeps the promise with `done`, and drops the lesson.
The journey runs the real `www` as a process, with its home and state folders inside the run's
folder under `.wringer/`, so it never touches your own stores.

## Journey

Run `bun verify up --restart` first, so `trial-kinds` does not exist yet, then `doctor`.

```bash
bun verify use --feature new-kinds
bun verify www run --line 'www init trial-kinds --goal "Ship the tide chart in the sailing app"' --expect 'Started session trial-kinds in '
bun verify www run --line 'www --session trial-kinds rule r-units "Show depths in metres; the chart API sends feet"' --expect 'r-units  rule, open. Brief: '
bun verify www run --line 'www --session trial-kinds lesson l-cache "Clear the chart cache before the screenshot tests" --why "A cached tile made the screenshot test pass on a broken build"' --expect 'l-cache  lesson, open, why 61 of 200. Brief: '
bun verify www run --line 'www --session trial-kinds promise due-demo "Demo build of the tide chart" --to owner --by "Friday, before standup"' --expect 'due-demo  promise to owner, by Friday, before standup. Brief: '
bun verify www run --line 'www --session trial-kinds words w-small "Keep each change small enough to read in one sitting" --where chat' --expect 'w-small  owner'"'"'s words, open, 52 of 300. Brief: '
bun verify www run --host codex --line 'www --session trial-kinds' --expect 'WORDS (1, max 8)'
bun verify www run --host codex --line 'www --session trial-kinds' --expect '  due-demo    Demo build of the tide chart  [to owner · by Friday, before standup]'
bun verify www run --host claude --line 'www --session trial-kinds' --expect '  l-cache     Clear the chart cache before the screenshot tests  [why: A cached tile made the screenshot test pass on a broken build]'
bun verify www run --line 'www --session trial-kinds list rules' --expect '  r-units     Show depths in metres; the chart API sends feet'
bun verify www run --line 'www --session trial-kinds recap' --expect 'PROMISED (1, max 5)'
bun verify www refuse --line 'www --session trial-kinds done l-cache --evidence "cleared"' --expect 'www: refused: l-cache is a lesson, and a lesson closes with drop.' --run 'www --session trial-kinds drop l-cache --why "<reason>"'
bun verify www run --line 'www --session trial-kinds done due-demo --evidence "demo build 41 shared in chat"' --expect 'due-demo  done. Off the brief, kept in the journal. Brief: '
bun verify www run --line 'www --session trial-kinds drop l-cache --why "the cache is gone from the test setup"' --expect 'l-cache  dropped. Off the brief, kept in the journal. Brief: '
bun verify www run --host codex --line 'www --session trial-kinds' --expect 'WORDS (1, max 8)'
```

## End state

- Each `bun verify www run` exits 0, and its `data.stdout` holds the `--expect` text. The brief
  shows `WORDS`, `PROMISED` and `LESSONS` sections, `www list rules` prints the rule, and the recap
  shows `PROMISED`.
- `done` on the lesson is refused with a `Run: www drop` line. `done` closes the promise and `drop`
  closes the lesson.
- The journey adds `--session trial-kinds` to each command, because a journey runs with no binding.
  The command is otherwise as printed.
- No expected text holds an age, which is real time.
- When a command fails, follow its row in [Exit codes](exit-codes.md) (step 4 of
  [Check a change](../SKILL.md#check-a-change)). When the end state does not match, follow step 5 of
  Check a change.
