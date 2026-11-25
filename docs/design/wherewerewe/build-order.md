# Build order

- **Status:** agreed

Slice 0 is the repo setup, done before this design, and is not one of the slices this doc builds. After it, the tool is built in eleven slices: 0b, 1, 2, 2b, 2c, 2d, 3, 3b, and 4 to 6. Each slice is one pull request, or several when it is too large to build and review in one run, and each pull request leaves the tool working. The agent that orchestrates the build keeps its own notes in the tool from the end of slice 1, so slice 1 gives a usable tool with no checks and no hooks, and each later slice adds to it. The `design-docs` skill would put the build order in work items, but it is in this doc because the owner signs it off together with the design, in one pull request, before any slice starts. When a slice starts, cut its work item from this doc and link its section here. Each slice gives what it delivers, what it needs first, and acceptance lines, each with its evidence. From slice 0b on, each slice in this repo also adds a wringer feature, whose journey drives the real `www` through `bun verify`, and its pull request carries the wringer report. Read this doc first, take the next slice whose dependencies are met, read the part docs that slice names, and build it.

## Shape

```mermaid
flowchart LR
  s0[0 repo setup, before this design] -.-> s0b[0b wringer]
  s0b --> s1[1 store, writes, brief, import]
  s1 --> s2[2 owner notes]
  s2 --> s2b[2b notes]
  s2b --> s2c[2c grant, format 2]
  s2c --> s2d[2d recap]
  s2d --> s3[3 checks]
  s3 --> s3b[3b limit, cut order, lists, new kinds]
  s3b --> s4[4 hooks and the gate]
  s4 --> s5[5 first release]
  s5 --> s6[6 skills]
```

## Slice 0: the repo

Done before this design, and not one of its eleven slices: the repo-standard skill creates `zgeoff/wherewerewe` as a public Bun workspace with `packages/cli`, CI and release wiring, and nothing published. Every later slice needs it.

## Slice 0b: wringer

**Delivers.** The repo adopts wringer, following `bunx wringer-gunshi guide create` at the installed version:

- `@wringer/core`, `@wringer/gunshi` and `zod` as exact dev dependencies in the root catalog, and each `@wringer/*` package by its full name in `minimumReleaseAgeExcludes` in `bunfig.toml`;
- `.wringer/` in `.gitignore`;
- the verify CLI in `scripts/verify/`, run as `bun verify`, with the scripts `verify` and `verify:lint`;
- the registry, named `wherewerewe-verify`, with one `local` target, a repo command that runs `www` as a process and compares its output, a doctor check that runs `www help`, `.shared()` for `scripts/verify/**`, `package.json` and `bun.lock`, and `.ignore()` for docs, Markdown, tests and agent folders;
- the `verify` skill in `.agents/skills/verify/`, from the template, with one `references/feature-<name>.md` per feature;
- the workflow `.github/workflows/verify.yml`, whose job is named `verify / gate`, on every pull request event including `edited`, with no path filter;
- a "Verify before you hand off" section in AGENTS.md;
- the feature `help`, whose journey runs `www help` and compares its first line.

The trial journey also settles how a target behaves for a CLI with no server: an `attach` target with no endpoints, or a `launch` target whose process prints a ready line. The slice records the shape that passes `bun verify doctor` in the registry and in the `verify` skill's targets block.

**Depends on.** Slice 0.

**Acceptance.**

- [ ] `bun verify lint` passes with `data.commands` above 0. Evidence: its output in the pull request.
- [ ] The `help` journey reaches its end state. Evidence: the wringer report block in the pull request, with a claim for `help`, and a green `verify / gate`.
- [ ] A change to a tracked file that maps to no feature, shared glob or ignore glob fails the gate. Evidence: a red `verify / gate` on a throwaway commit in the pull request, reverted before merge.
- [ ] `verify / gate` is a required check on `main`, added after the workflow has run once. Evidence: the ruleset lists the check.

## Slice 1: store, writes, brief and import

**Delivers.** The store in format 1 ([store.md](store.md)); every command in [commands.md](commands.md) except `say`, `ack`, `install`, `doctor`, `hook`, `grant`, `recap` and the commands that slice 3b adds, with no notes and in format 1; the brief ([brief.md](brief.md)) with no checks run, so each check tag reads `not checked yet`, no `CHANGED` section, and no pull request section; session finding by flag, variable and binding ([sessions-and-hooks.md](sessions-and-hooks.md), "How a command finds its session"); `www import`; the package and its bins ([shipping.md](shipping.md)). Two wringer features: `notes`, whose journey runs `www init`, `task`, `set`, `done` and `www`, and checks the brief and one refusal's `Run:` line; and `import`, whose journey imports a hand-kept fixture and reads its brief.

**Depends on.** Slice 0b.

**Acceptance.**

- [ ] Each write in commands.md changes only the files it names, and a refused write changes none. Evidence: a store test per command.
- [ ] Each refusal in commands.md prints its text and its `Run:` line, and the `Run:` line, with its placeholders filled in, passes. Evidence: one test per refusal row.
- [ ] A store with every cap full and every text at its limit renders within the line and character caps in brief.md. Evidence: the worst-case render test.
- [ ] Two sessions bound to two agent session ids never read or write each other's store. Evidence: a test with two `CLAUDE_CODE_SESSION_ID` values.
- [ ] `www import` converts a fixture laid out like the hand-kept store, with invented content, following the table in store.md, keeps the originals in `import-backup/`, and refuses with one line per bad row when a row breaks a rule. Evidence: import tests for both cases.
- [ ] Ten writes started at once all land, and none corrupts a file. Evidence: a concurrency test.
- [ ] A copy installed from a packed tarball runs as `www` and as `wherewerewe` after the worktree is removed. Evidence: a CI step that packs, installs with `bun add -g`, deletes the source folder, and runs `www help`.
- [ ] The `notes` and `import` journeys reach their end states. Evidence: the wringer report block in the pull request, with a claim for each, and a green `verify / gate`.
- [ ] The orchestrating agent's hand-kept store converts. Evidence: after the agent fixes the rows that `www import` refuses, `www import build` exits 0, and `www --session build` prints its brief.

**Pull requests.** Build slice 1 as three pull requests, and start each one after the one before it merges:

- 1a, [#11](https://github.com/zgeoff/wherewerewe/issues/11): the store in format 1, session finding, the brief, and `www`, `help`, `sessions`, `init`, `attach`, `detach`, `goal`, `now`, `task`, `wait`, `rule`, `where`, `set`, `done` and `drop`, with the `notes` feature. It carries the evidence for the worst-case, two-session, concurrency, packed-tarball and `notes` journey lines, and for the write and refusal lines of its commands.
- 1b, [#12](https://github.com/zgeoff/wherewerewe/issues/12): `ok`, `use`, `decide`, `show` and `log`. It carries the evidence for the write and refusal lines of its commands.
- 1c, [#13](https://github.com/zgeoff/wherewerewe/issues/13): `www import`, with the `import` feature. It carries the evidence for the import, `import` journey and hand-kept store lines, and for the hand-kept refusal's `Run:` line.

## Slice 2: owner notes

**Delivers.** `www say` and `www ack`, `owner.tsv`, and the `OWNER SAYS` section ([owner-notes.md](owner-notes.md)). The wringer feature `owner-notes`, with a journey that runs `www say` and `www ack` through the terminal driver, which gives the program a terminal, and reads the brief between them. The slice adds `@wringer/terminal`, pinned and excluded as in slice 0b, and the program's environment carries none of the five agent variables.

**Depends on.** Slice 1.

**Acceptance.**

- [ ] The `owner-notes` journey reaches its end state. Evidence: the wringer report block in the pull request, with a claim for `owner-notes`, and a green `verify / gate`.
- [ ] `say` and `ack` refuse when stdin or stdout is not a terminal, and when any of the five agent variables is set. Evidence: tests that run each case, using `script` to give a terminal.
- [ ] A note shows first after the goal and the grant until `ack`, and a third note is refused. Evidence: brief tests.
- [ ] No agent command opens `owner.tsv` for writing. Evidence: a test that makes `owner.tsv` read-only and runs every agent write.

## Slice 2b: notes

**Delivers.** Notes as [commands.md](commands.md) and [store.md](store.md) define them: `notes.tsv` in format 1, where a missing file reads as no notes; `--note` and `--owed` on `now` and on every item write; `set` with no claim; `--no-note`; the 400-character limit and the credential test on a note; the note lines in the `now` and close replies; the older-note line; the owed-note refusal on `done`, `drop` and `use`; the note in `www show`; and the `note` rows in `www log`. In the brief ([brief.md](brief.md)): the note under `NOW`, the owed tags, the wrap rule for the goal and the note, at most 3 changed rows and 1 pull request row, and the one-line footer. The slice also removes the caution wording that names no grant: the `APPROVED` heading's text after its count, the last sentence of the refusal of `use` on a standing approval, and the `--replaces` refusal's text, as decision record [0008](../../decisions/0008-notes-the-grant-and-no-caution-steering.md) lists them. The wringer feature `item-notes`, with a journey that writes a task with `--note` and `--owed`, runs `www now` on it, reads the brief, runs `done` and gets the owed-note refusal, runs the refusal's `--no-note` `Run:` line, and closes the task.

**Depends on.** Slice 2.

**Acceptance.**

- [ ] The `item-notes` journey reaches its end state. Evidence: the wringer report block in the pull request, with a claim for `item-notes`, and a green `verify / gate`.
- [ ] A store with every cap full, three standing approvals, every text at its limit, an owed note on every item, 400 characters long on the item in focus, renders in at most 52 lines and 6,400 characters. Evidence: the worst-case render test, at 6,374 characters by the arithmetic in brief.md with the 3 standing approval lines in place of the grant and the one-time approval.
- [ ] The note of the item in focus prints whole under `NOW`, after its next step and when it has none, and every item with an owed note, the item in focus included, shows the owed tag. Evidence: brief tests.
- [ ] A 400-character note of words that end at column 85 wraps to 5 lines, and a 200-character goal of 49-character words wraps to 3. Evidence: wrap tests.
- [ ] `done`, `drop` and `use` refuse while an owed note stands, print the note, and each `Run:` line in the refusal runs. Evidence: one refusal test per command.
- [ ] `set <id> --note` keeps the claim, its check, `at_write` and `written`, and a close removes the item's `notes.tsv` row while its `note` rows stay in the journal. Evidence: store tests.
- [ ] A rewrite of a claim that keeps an older note prints the older-note line, and each command in that line runs. Evidence: reply tests.
- [ ] The build session's store, which has no `notes.tsv`, reads with no notes. Evidence: `www --session build` output after the install.

## Slice 2c: the grant and store format 2

**Delivers.** Store format 2 ([store.md](store.md)): the `grant` keys in `session`, one line per bullet, no `use` key, and one `ok` item at most. `www grant`, with `--may`, `--not` and `--never` bullets and `--scope`, and `www grant --reading`, with their limits, replies and refusals; the `GRANT` section of the brief, whole after `GOAL`, in bullets under `may`, `not` and `never`, and never cut; `www show grant`; the `grant` rows in `www log`; the `ok --standing` refusal and the one-time approval cap of 1; the `APPROVED ONCE` section; the format 2 upgrade through `www import`, with the grant's flags and `--drop`, its refusals and `format-1-backup/`; the hand-kept import to format 2; exit 5 for a format 1 store; the reserved id `grant`; the `say` replies' "It shows in every brief" wording from [owner-notes.md](owner-notes.md), and the rest of the wording changes in [0008](../../decisions/0008-notes-the-grant-and-no-caution-steering.md). The wringer feature `grant`, with a journey that seeds a format 1 store holding two standing approvals, runs `www import` and gets the refusal, runs the refusal's `Run:` line with the owner's words as bullets, reads the brief's `GRANT` section, replaces the reading with `www grant --reading`, and reads `www show grant`.

**Depends on.** Slice 2b. The owner's sign-off of this design authorises the build agent to upgrade the build session's store, as [README.md](README.md) lists.

**Acceptance.**

- [ ] The `grant` journey reaches its end state. Evidence: the wringer report block in the pull request, with a claim for `grant`, and a green `verify / gate`.
- [ ] The worst case in brief.md renders in at most 73 lines and 7,200 characters. Evidence: the worst-case render test, which seeds every row of the worst-case table in brief.md.
- [ ] The grant prints whole after `GOAL`, and a store whose item lines pass the cap keeps the whole grant while cut-to-fit drops item lines. Evidence: brief tests.
- [ ] A format 1 store with two standing approvals and two one-time approvals makes the upgrade refuse with both problems and one `Run:` line, and leaves every file and the folder listing unchanged. With the `Run:` line's placeholders filled, the upgrade converts it as the table in store.md says, and `format-1-backup/` holds the original files. The test seeds the store by hand, because format 1's `ok` caps approvals at 3 and this store holds 4. The upgrade applies no such cap. Evidence: import tests that hash the folder before and after.
- [ ] Every command except `import`, `sessions` and `help` exits 5 on a format 1 store, with the text in commands.md: `detach` keeps the binding, and `init <name>` exits 5 when `<name>` holds a format 1 store. `install` and `doctor` read no store, and `hook` reads a store only as sessions-and-hooks.md says; a bound session's `www` prints the same text. Evidence: one test per command.
- [ ] The grant prints in bullets under `may`, `not` and `never`, and short `never` bullets share a line. The grant's bullets and scope take 700 characters after each line break becomes a space, in at most 12 bullets of 120 characters, and the limits on the bullets, the scope, the reading and `--where` and the credential test refuse with the texts in commands.md. Evidence: renderer, write and refusal tests.
- [ ] The build session's store upgrades to format 2, with the owner's words that authorise the build as its grant. Evidence: the output of `www import build` and of `www --session build`, which shows the `GRANT` section.

## Slice 2d: recap

**Delivers.** `www recap [--since <t>]` with its sections, row limits and overflow lines ([commands.md](commands.md)). The wringer feature `recap`, with a journey that writes notes, decisions and closes in an invented session, runs `www recap`, and runs one overflow line's command.

**Depends on.** Slice 2c, so the recap prints the grant.

**Acceptance.**

- [ ] The `recap` journey reaches its end state. Evidence: the wringer report block in the pull request, with a claim for `recap`, and a green `verify / gate`.
- [ ] A store with the brief's worst-case grant (12 bullets and a 40-character scope holding 700 characters), 20 open items, 19 of them with a 400-character note, 9 decisions and 9 closes since `<t>`, and a 24-character session name renders a recap of at most 55 lines, each at most 100 characters. Evidence: the recap worst-case test.
- [ ] The recap runs no probe and takes no lock. Evidence: a test with the lock held and a stub `gh` on `PATH` that fails when called.
- [ ] Each overflow line's command runs and prints the rows the recap left out. Evidence: tests that run the printed commands.

## Slice 3: checks

**Delivers.** The four probes, `at_write` on each write, `last` and `changed` rows on each read, the `CHANGED SINCE WRITTEN` section, the hidden next step, the `unchecked` header, and the pull request section's probing ([checks.md](checks.md)). The wringer feature `checks`, with a journey that writes an item with a `--path` check, removes the path, reads the `CHANGED` row, and runs the fix command it prints. It uses no network: the `pr` probe stays with the tests.

**Depends on.** Slice 2d, so the day-9 snapshot can show an owner note, the grant and a note.

**Acceptance.**

- [ ] The `checks` journey reaches its end state. Evidence: the wringer report block in the pull request, with a claim for `checks`, and a green `verify / gate`.
- [ ] Each probe returns each result in its table. Evidence: tests against a stub `gh` on `PATH`, temporary git repos, and a child process the test starts and kills.
- [ ] A merged pull request, a gone process and a missing path each show under `CHANGED` with the fix command from brief.md, and that command runs as printed on an item with no owed note. Evidence: brief tests that run the printed commands.
- [ ] The next step hides when the item in focus changes after `now_set`, and the item's note still prints whole under the `next step hidden` line. Evidence: a brief test.
- [ ] The day-9 example in brief.md renders as printed, from a store seeded to match it and a stub `gh`. Evidence: a snapshot test.
- [ ] With `gh` missing, with `gh` failing authentication, and with a probe that never returns, the brief prints within 6 s, tags each probe `unchecked`, and gives the reason in the header. Evidence: tests for the three cases.
- [ ] A read with the store folder read-only prints the brief and the `results not saved` line. Evidence: a test.
- [ ] No probe writes: the git repos' index files and refs are unchanged after a read. Evidence: a test that hashes `.git` before and after.

## Slice 3b: the brief's limit, the cut order, the list command and the new kinds

**Delivers.** The per-host limit of [brief.md](brief.md), held in bytes and given in estimated tokens, with the line limit gone; the cut order and the cut lines; the `DECISIONS` section; `www list` ([lists-and-json.md](lists-and-json.md)); the three new kinds, `www lesson`, `www promise` and `www words`, with their files ([store.md](store.md)), brief sections, `show` and `log` rows, replies and refusals; the new caps of waits, rules, where items and owner's words; the `Brief: <t> of <limit> tokens.` replies; `PROMISED` in `www recap`; `--json` on the read commands; `www goal --paste`; and the help text and the day-9 brief, each in the block its test reads, changed in the same pull request as the code and the tests. The slice also rewrites the brief paragraph of `docs/architecture/overview.md` to the built limit. The wringer feature `new-kinds`, whose journey writes a lesson, a promise and owner's words, reads the brief, runs `www list rules` and `www recap`, keeps the promise with `done`, and drops the lesson.

**Depends on.** Slice 3, which builds the checks and the day-9 snapshot test; slice 3b updates that snapshot for the new blocks.

**Acceptance.**

- [ ] The `new-kinds` journey reaches its end state. Evidence: the wringer report block in the pull request, with a claim for `new-kinds`, and a green `verify / gate`.
- [ ] The ASCII worst case of brief.md renders within each host's limit, 24,000, 30,000 and 60,000 bytes, and cuts nothing. Evidence: the worst-case render test for each host.
- [ ] A store whose every stored text is in a 3-byte script renders within each host's limit, drops rows in the cut order of brief.md, and ends each section that lost rows with its cut line, whose `www list <kind>` command prints every row of that kind. Evidence: cut tests that run the printed commands.
- [ ] The brief's header starts with `<name> · day` and its last line is the footer, for every store. Evidence: a renderer test that the hooks slice reuses.
- [ ] Each write reply ends `Brief: <t> of <limit> tokens.`, with `<t>` the estimate of the brief rendered from the saved store, using saved check results and running no probe, and `<limit>` the reader's host's. Evidence: reply tests for each host.
- [ ] `www list` prints every open row of each kind in commands.md, and exits 2 with its `Run:` line for no kind or an unknown one. Evidence: list tests.
- [ ] The brief prints the 3 newest decisions in force and a count line with `www list decisions`; a replaced or ruled-out decision never counts. Evidence: brief tests.
- [ ] `www lesson`, `www promise` and `www words` write only their own file and the journal, refuse at their caps, refuse each text over its limit and each credential, and a refused write changes no file. A store with none of the three files reads with none. Evidence: store and refusal tests.
- [ ] `done` refuses a lesson and owner's words with a `Run: www drop` line, and `done` and `drop` close a promise. Evidence: refusal and store tests.
- [ ] A recap with the worst-case grant, 5 promises and the rest of the recap's worst case renders in at most 61 lines, each at most 100 characters. Evidence: the recap worst-case test.
- [ ] The help test matches the help block in commands.md. Evidence: the help test.
- [ ] In the same pull request as the code and the tests, slice 3b changes the help block in commands.md and the sentences that name the slices the help reflects, and the day-9 block in brief.md and its count sentence. It updates `run-cli.test.ts` and `run-brief-command.test.ts` to match, the 60 lines and 4,228 bytes included, and the hard-coded copies in `render-log.test.ts`, the reply test and `render-recap.test.ts`. Evidence: both doc-reading tests green, and no subsection of the design holds text for a later slice to move.
- [ ] Each read command with `--json` prints one JSON value that parses as its type in lists-and-json.md, for the day-9 store and the worst-case store, and exits with the code the text form gives. Evidence: JSON tests, with a schema test that pins each type.
- [ ] `www goal --paste` prints the `/goal` text of lists-and-json.md, at most 4,000 characters for the worst-case grant, and with no grant refuses with a `Run: www grant` line. Evidence: goal tests.

## Slice 4: hooks

**Delivers.** `www hook claude` and `www hook codex`, `www install`, `www doctor`, the pull request record, binding from the hook, the nudge, and the `SubagentStart` line ([sessions-and-hooks.md](sessions-and-hooks.md)), and the `www` skill that `www install` writes. Also the gate: the `SessionStart` injection and wipe, the `PreToolUse` refusal, the `PostToolUse` whole-read check, the `PostToolUseFailure` entry, the `Stop` block, and the gate file; and the allow rules that `www install` writes and `www doctor` checks. The wringer feature `hooks`, with a journey that pipes an invented `SessionStart` payload and an invented `PostToolUse` payload into `www hook claude` and `www hook codex`, for a bound and an unbound id, and runs `www install` against settings files under the run's home folder. For both harnesses, the journey also pipes an invented `SessionStart` payload, then a `PreToolUse` payload for `ls`, which is refused, then one for `www`, which passes; pipes a `PostToolUse` payload holding a whole brief; then pipes `PreToolUse` for `ls` again, which passes. The journey stays with invented payloads, because the Codex proofs need the owner's trust step.

**Depends on.** Slice 3b. The owner's sign-off of this design authorises the build agent to run `www install` and to add the two Codex config lines, as [README.md](README.md) lists. Trusting the five hook entries in Codex's `/hooks` is a step only the owner can do, by hand, once, after `www install`; the Codex proofs below wait for it, and none uses `--dangerously-bypass-hook-trust`.

**Acceptance.**

- [ ] The `hooks` journey reaches its end state. Evidence: the wringer report block in the pull request, with a claim for `hooks`, and a green `verify / gate`.
- [ ] For each event and each harness, a recorded stdin payload gives the output in sessions-and-hooks.md, and an unbound session id gives no output. Evidence: hook tests with invented payloads in each agent's documented shape.
- [ ] An unbound hook returns in under 150 ms, a bound `PostToolUse` in under 300 ms, a bound or unbound `PreToolUse` and `Stop` in under 150 ms, and a bound `SessionStart` in under 300 ms. Evidence: a timing test of 20 runs, median.
- [ ] `install` keeps every other hook in both files, and a second run changes nothing. Evidence: install tests on fixture settings files.
- [ ] After a compaction in a bound Claude Code session, the goal and the grant are in context, the agent's next tool call is refused with the reason of sessions-and-hooks.md, the agent runs `www`, and the call after it passes. Evidence: a `claude -p` session that stream-json input drives through `/compact`, with its transcript and the gate file's states.
- [ ] The refusal reaches the model, including through code mode, and the model runs `www`; the main agent's whole read writes `read`, and the next call passes. Evidence: the session's rollout and the gate file's states.
- [ ] `SessionStart` fires with source `startup`, with `resume` on `codex exec resume`, and with `compact` after a compaction forced with `-c model_auto_compact_token_limit`, and its `session_id` equals the shell's `CODEX_THREAD_ID` each time. Evidence: the rollouts and the hook error log's debug lines.
- [ ] A subagent's tool calls either carry `agent_id` and pass, or carry none and pass on the parent's state; and a subagent's whole read writes the parent's `read` only when its payload has no `agent_id`. Evidence: a session on each host that spawns a subagent which runs `www` after a compaction has set the parent's state to `wiped`, so a wrong write of `read` shows, with the gate file's states. This settles whether Codex sends `agent_id` on tool events, the open question in sessions-and-hooks.md.
- [ ] When `www` is missing from `PATH` or exits 5, the next call that is not a `www` command passes with the gate's one line. Evidence: two sessions, one for each case.
- [ ] After a refusal or the `SessionStart` line, the model calls `www` with `max_output_tokens: 10000`, and the brief arrives whole; after a cut read, the gate refuses once with the cut reason, and refuses no more than that one call however many retries are cut, and a failed retry opens it on the next call. Evidence: the rollouts of 20 gated Codex sessions at the owner's settings with a brief at Codex's limit, which count the `www` calls whose cap × 4 is under the brief's bytes, and two further sessions that force a cut read, then a retry that is cut again in one and a retry that fails in the other, each ending with at most one refusal after the first cut; the count settles the open question in brief.md.
- [ ] `tool_response` for a shell call holds the output, its exit code when Codex gives one, and the truncation marker when Codex cut the output; `tool_input` carries `max_output_tokens` when the model passed it; `tool_use_id` is the same on the `PreToolUse` and the `PostToolUse` of one call; and a `www` the person rejects fires no `PostToolUse`, or the hook log shows which event it fires. Evidence: recorded payloads from the session, stored as hook test fixtures.
- [ ] With the Codex rule of sessions-and-hooks.md installed, a Codex session runs `www` with no approval prompt, and `codex execpolicy check` returns `allow` for `www` and `www --session <name>`. Evidence: the session's rollout and the check's JSON.
- [ ] Codex's shell output limit and Claude Code's are still at or above the constants of brief.md on the installed versions. Evidence: a stub that prints a known size, measured on each host.
- [ ] A Codex subagent's shell either finds the parent's session or gets the refusal with the `--session` hint. Evidence: the same Codex test session; the result settles the open question in sessions-and-hooks.md.
- [ ] For a bound session with a hand-kept or format 1 store, `SessionStart` prints only the two lines, `www` exits 5 with its text, and the next call that is not a `www` command passes with the gate's one line. Evidence: hook tests for both harnesses.
- [ ] A piped read (`www | tail -1`), a redirected read (`www > brief.txt`), a filtered read (`www --session tide-alerts | grep ^OPEN`) and a subagent's read (a payload with `agent_id`) each leave the state as it was; a read whose output lacks the footer or holds `<persisted-output>` is a failed end, which never writes `read`; the main agent's whole `www` writes `read`. Evidence: hook tests with recorded payloads, and a Claude Code session that runs the piped and the subagent read.
- [ ] A `PreToolUse` or `Stop` payload with `agent_id` passes, and a bound id with no gate file passes. Evidence: hook tests.
- [ ] `Stop` blocks once while the state is `wiped`, and, when `stop_hook_active` is true, passes and writes `failed`. Evidence: hook tests for both harnesses.
- [ ] The gate's four invariants in sessions-and-hooks.md hold for every sequence of the state table's events up to length 8, with `SessionStart` at any point, subagent payloads, and brief commands that get no end event among them. Evidence: a hook test that drives the gate through each sequence, with no clock and no sleep, and checks each invariant after each event.
- [ ] Each ordering listed under the state table gives, on both harnesses, the table's decision for each call as it arrives and the table's state after each event: a call batched with the brief command before and after the read's end, two batched calls then a cut read, a retry that fails, a slow `www`, `www` refused at the permission step, a brief command that runs across a compaction, two hooks at once, and exit 5. The cut and retry orderings run on Codex payloads. Evidence: hook tests that replay each ordering with recorded payloads, and the hook log of a Claude Code session that batches `ls` with `www`.
- [ ] A `www` refused at Claude Code's permission step leaves the state `reading` until `Stop`, and the next call after it passes with the gate's one line. Evidence: a `claude -p` run in the default mode with no allow rule, with the hook log and the gate file's states.
- [ ] Two hook processes started at once on one gate file both apply their events: two brief commands give `reads=2`, and two calls refused in `cut` with `spare=1` give one refusal and one pass. Evidence: a hook test that starts the two processes together and waits for both to exit, with no sleep.
- [ ] A `www` the host kills at its shell timeout ends as a failed call. Evidence: the hook logs that settle the open question in sessions-and-hooks.md.
- [ ] A `www` command chained to another command with `;`, `&&`, `||` or `&`, or piped to a command outside the filters of sessions-and-hooks.md, is gated like any other call, and a `www` command piped to `tail` or redirected passes. Evidence: hook tests.
- [ ] A separator inside single or double quotes, or escaped by a backslash, chains nothing: each command of the worked examples in sessions-and-hooks.md gets the gate it lists, `www task t-a "Check logs; record the result"` passes, and `www task t-a "Logs at $(date)"` is gated. Evidence: hook tests with one row per worked example.
- [ ] After `www attach` binds an agent session id that has a gate file to another store, each hook reads that file as `wiped` for that store, so the main agent's next call that is not a `www` command is refused and only the main agent's whole read of that store's brief writes `read`; and a bound id with no gate file still records pull requests and nudges. Evidence: hook tests.
- [ ] `www install` writes the six Claude Code entries and the five Codex entries of sessions-and-hooks.md, with no matcher on `PreToolUse`, and writes no `onFailure`, `additionalContextLimit` or `bashOutputMaxChars`; a second run changes nothing. Evidence: install tests on fixture settings files.
- [ ] `www install` prints the Claude Code allow rule before it writes, adds it to `permissions.allow` in `~/.claude/settings.json` once, keeps every other key and rule, and adds no other permission rule; `www doctor` reports the rule when it is missing. Evidence: install and doctor tests on fixture settings files.
- [ ] `www install` prints the Codex rule before it writes, writes `~/.codex/rules/wherewerewe.rules` once, and leaves every other rules file alone; `www doctor` reports the file or rule missing, and a `codex execpolicy check` decision other than `allow`. Evidence: install and doctor tests on fixture folders, with a stub `codex`.
- [ ] With the rule installed, a bound session in Manual mode runs `www` with no prompt, and an auto mode session runs it with no classifier line in the debug log. Evidence: a `claude -p` run in each mode.
- [ ] The worst-case `SessionStart` injection reaches each host's context whole. Evidence: the hook's stdout measured against 10,000 characters, the Claude Code transcript of the compaction line above, and the rollout of a Codex session that starts on the worst-case store and shows the injection whole.
- [ ] The tool writes no `classifierContext`. Evidence: a test over every hook output.
- [ ] `www install` writes the `www` skill for each host from the text the binary carries, replaces only a skill it wrote and nobody edited, refuses any other file with a `Run: www install --replace-skill` line and writes nothing, and a second run changes nothing; `--print` shows the skill files. Evidence: install tests on fixture homes.
- [ ] Every command and flag in the skill is one the parser takes, the skill stays under 350 words, and `www doctor` reports a skill that differs from the binary's. Evidence: the skill test and doctor tests.
- [ ] `www doctor` exits 0 on the owner's machine. Evidence: its output, after the owner steps.
- [ ] `www install`, `www doctor` and `www hook` never open `owner.tsv` for writing. Evidence: the read-only `owner.tsv` test from slice 2 runs each of the three, and finds the file's inode, mode and bytes unchanged.

## Slice 5: first release

**Delivers.** `@wherewerewe/cli` on npm, with bins `www` and `wherewerewe`. The wringer feature `package`, with a journey that installs the published version into a temporary global folder with `bun add -g` and runs `www help` and `wherewerewe help`.

**Depends on.** Slice 4, and the owner's first publish by hand, a step only the owner can do, through the npm-publish skill, which hands the owner one command. Later releases go through release-please and OIDC.

**Acceptance.**

- [ ] The `package` journey reaches its end state. Evidence: the wringer report block in the pull request, with a claim for `package`, and a green `verify / gate`.
- [ ] `bun add -g @wherewerewe/cli` on a machine with only Bun installs both bins. Evidence: `www help` output in a clean container.
- [ ] The second release publishes from CI with provenance. Evidence: the npm page's provenance badge for that version.

## Slice 6: skills

**Delivers.** The handoff, where-were-we and pickup changes in [skills.md](skills.md), as one pull request in `zgeoff/skills`. Each of the three skills covers notes, with `--note`, `--owed` and the rule that a note holds what the agent needs on its next turn to the item, and the grant, with `www grant`, the `GRANT` section and the owner's words copied whole.

**Depends on.** Slice 5, so a skill can refer to a command any machine can install. `zgeoff/skills` has no wringer, so this slice has no wringer feature: that repo's own checks are its evidence.

**Acceptance.**

- [ ] Each skill passes the skill-writing checks of `zgeoff/skills`. Evidence: the pull request's `## Checks` section and green CI.
- [ ] A handoff doc written from a bound session fills each section from the store following the table in skills.md, with the grant's words whole and each open item's note. Evidence: a handoff doc from an invented session, attached to the pull request.
- [ ] A pickup from that handoff doc into a store with no grant records the doc's grant with `www grant`. Evidence: the brief's `GRANT` section in the invented session after the pickup.

## Constraints

- Each slice from 0b on is one pull request into `main` of its repo, or several that each leave the tool working, with green CI, and leaves every earlier acceptance line true. Slice 2c is the first exception: format 2 replaces format 1 and folds standing approvals into the grant, so from then on the slice 1 lines that name format 1 hold for format 2, and the bound in brief.md replaces the worst-case line of slice 2b. Slice 3b is the second: the per-host limit in estimated tokens replaces the per-host line and character caps, so the worst-case lines of slices 2b and 2c give way to slice 3b's, and slice 2d's recap line of 55 lines gives way to slice 3b's 61.
- Each slice is built with the build-feature workflow, with a Codex review as its only review.
- From slice 0b on, each pull request in this repo publishes the wringer report with `bun verify publish` after its last push, and every feature whose files it changed has a claim at the current fingerprint.
- The registry is named `wherewerewe-verify`, never `www` or `wherewerewe`: gunshi reads a command group named like the program as the program itself, so the registry's name and its `www` command group must differ.
- A journey runs `www` with `XDG_STATE_HOME` and `HOME` pointed at folders under `.wringer/`, so it never reads or writes the owner's stores or agent settings.
- From the end of slice 1, the orchestrating agent writes its own notes only through `www`, and installs each merged slice with the commands in shipping.md.
- A slice changes no contract in another part's doc without changing that doc in the same pull request.

## Builder decides

- How each slice splits into commits.
- Test names and fixture layout.
