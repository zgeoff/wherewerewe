# tasks

Check that a session holds 20 open tasks and that the owner reads them in two places. A user starts
a session, writes a wait, a task blocked by it, a task with an owed note and 18 more tasks, and sets
one in focus. The brief prints all 20 task rows under `OPEN (20, max 30)`, 30 being the task limit,
the item in focus first, once for a Codex agent and once for a Claude Code agent. `www show` with no
id lists every task with the owed note whole. The journey runs the real `www` as a process, with its
home and state folders inside the run's folder under `.wringer/`, so it never touches your own
stores.

## Journey

Run `bun verify up --restart` first, so `trial-tasks` does not exist, then `doctor`.

```bash
bun verify use --feature tasks
bun verify www run --line 'www init trial-tasks --goal "Move the ferry timetable app to the new routing API"' --expect 'Started session trial-tasks in '
bun verify www run --line 'www --session trial-tasks wait w-keys "the routing API keys for staging" --who owner' --expect 'w-keys  wait, open, no check.'
bun verify www run --line 'www --session trial-tasks task t-01 "Port the stop search to the routing API"' --expect 't-01  task, open, no check.'
bun verify www run --line 'www --session trial-tasks task t-02 "Port the trip planner to the routing API"' --expect 't-02  task, open, no check.'
bun verify www run --line 'www --session trial-tasks task t-03 "Load the timetable from the routing API" --blocked-by w-keys' --expect 't-03  task, open, no check.'
bun verify www run --line 'www --session trial-tasks task t-04 "Turn on the ferry_v2 flag in staging" --note "Turn the ferry_v2 flag off in staging before this closes: QA demos on Friday." --owed' --expect 't-04  task, open, no check, note 77 of 400, owed.'
bun verify www run --line 'www --session trial-tasks task t-05 "Map the old stop ids to the new ones"' --expect 't-05  task, open, no check.'
bun verify www run --line 'www --session trial-tasks task t-06 "Drop the legacy fare lookup"' --expect 't-06  task, open, no check.'
bun verify www run --line 'www --session trial-tasks task t-07 "Retry a 429 from the routing API twice"' --expect 't-07  task, open, no check.'
bun verify www run --line 'www --session trial-tasks task t-08 "Cache route shapes for 10 minutes"' --expect 't-08  task, open, no check.'
bun verify www run --line 'www --session trial-tasks task t-09 "Show the next 3 sailings on the stop page"' --expect 't-09  task, open, no check.'
bun verify www run --line 'www --session trial-tasks task t-10 "Move the delay banner to the new feed"' --expect 't-10  task, open, no check.'
bun verify www run --line 'www --session trial-tasks task t-11 "Update the offline timetable bundle"' --expect 't-11  task, open, no check.'
bun verify www run --line 'www --session trial-tasks task t-12 "Fix the time zone of the night sailings"' --expect 't-12  task, open, no check.'
bun verify www run --line 'www --session trial-tasks task t-13 "Add the new pier at Northgate"' --expect 't-13  task, open, no check.'
bun verify www run --line 'www --session trial-tasks task t-14 "Rename routes to match the operator"' --expect 't-14  task, open, no check.'
bun verify www run --line 'www --session trial-tasks task t-15 "Test the planner against 50 saved trips"' --expect 't-15  task, open, no check.'
bun verify www run --line 'www --session trial-tasks task t-16 "Remove the old routing API client"' --expect 't-16  task, open, no check.'
bun verify www run --line 'www --session trial-tasks task t-17 "Log the routing API latency per call"' --expect 't-17  task, open, no check.'
bun verify www run --line 'www --session trial-tasks task t-18 "Check the app size after the move"' --expect 't-18  task, open, no check.'
bun verify www run --line 'www --session trial-tasks task t-19 "Write the migration notes for support"' --expect 't-19  task, open, no check.'
bun verify www run --line 'www --session trial-tasks task t-20 "Write the release notes for the routing move"' --expect 't-20  task, open, no check.'
bun verify www run --line 'www --session trial-tasks now t-20 "draft the notes from the merged PRs"' --expect 'now: t-20.'
bun verify www run --host codex --line 'www --session trial-tasks' --expect 'OPEN (20, max 30)'
bun verify www run --host codex --line 'www --session trial-tasks' --expect '  t-20        Write the release notes for the routing move'
bun verify www run --host codex --line 'www --session trial-tasks' --expect '  t-01        Port the stop search to the routing API'
bun verify www run --host claude --line 'www --session trial-tasks' --expect 'OPEN (20, max 30)'
bun verify www run --host claude --line 'www --session trial-tasks' --expect '  t-20        Write the release notes for the routing move'
bun verify www run --host claude --line 'www --session trial-tasks' --expect '  t-01        Port the stop search to the routing API'
bun verify www run --line 'www --session trial-tasks show' --expect 'OPEN (20, max 30)'
bun verify www run --line 'www --session trial-tasks show' --expect 'Turn the ferry_v2 flag off in staging before this closes: QA demos on Friday.'
bun verify www run --line 'www --session trial-tasks show' --expect '  t-11        Update the offline timetable bundle'
```

## End state

- Each `bun verify www run` exits 0, and its `data.stdout` holds the `--expect` text: the session
  holds 20 open tasks. The brief prints all 20 rows under `OPEN (20, max 30)`, with the item in
  focus and the oldest task among them, read once with the Codex host and once with the Claude Code
  host. `www show` lists every task with the owed note whole. A `bun verify www run` fails with
  `check-failed` when `www` exits other than 0 or prints other text.
- The note's count, 77, is code points.
- No expected text holds an age or the order of two tasks written in the same second, which depend
  on real time.
- When a command fails, follow its row in [Exit codes](exit-codes.md) (step 4 of
  [Check a change](../SKILL.md#check-a-change)). When the end state does not match, follow step 5 of
  Check a change.
