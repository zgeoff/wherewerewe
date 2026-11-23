# The commands

- **Status:** agreed

`www` is one command with a subcommand per write. Every write answers in one line that ends with the brief's length, so the agent sees what each line costs. Every refusal prints a command to run next: the fixed call when the tool can fix it, or else the command that shows what the fix needs. A build agent reads this doc to build the command-line parser, the write replies and the refusals, in the slice [build-order.md](build-order.md) names.

## Contracts

### www help

`www help` prints this text, and `www --help` and `www -h` do the same. The lines below are fixed; [Builder decides](#builder-decides) covers only spacing.

```text
www (wherewerewe): what is true now in one long agent session, in one short brief.

Read. Run www first, after every compaction, and whenever you are unsure:
  www                        the brief: goal, owner notes, what changed, now, open work, waits,
                             approvals, rules, where things are. Runs every check.
  www show <id>              one item or decision: its claim, its check now, its journal rows
  www log [--since <t>] [--op <op,...>] [--id <id>]
                             the journal, oldest first. <t> is 24h, 3d or day-7
  www sessions               every session on this machine

Write as you go. One id holds one claim, and each write replaces it:
  www now <id> "<next step>"
  www task <id> "<claim>" [<check>] [--blocked-by <id>]
  www wait <id> "<what>" --who <who> [<check>]
  www ok <id> --quote "<their exact words>" --who <who> --where <where> --scope "<scope>" (--once | --standing)
  www rule <id> "<do it this way, and why>"
  www where <id> "<what and where, and how to stop it>" [<check>]
  www set <id> "<claim>" [<check>]
  www decide "<choice>" --why "<reason>" [--on <id>] [--who owner] [--ruled-out] [--replaces d-<n>]
  www goal "<what done means>"

Close. Each leaves the brief and stays in the journal:
  www done <id> --evidence "<PR, commit or test run>"
  www drop <id> --why "<reason>"
  www use <id> --for "<what you did with it>"     spend a --once approval

Checks, one per item: --pr <owner>/<repo>#<n>  --branch <repo path>@<branch>  --path <path>  --pid <n>

Owner, from a terminal outside any agent:  www say "<text>" [--on <id>]   www ack o-<n>

Session: www init <name> --goal "<goal>"   www attach <name>   www detach   www import <name>
Setup:   www install [--print]   www doctor
Any command takes --session <name>.

Limits: a claim is one line of at most 120 characters. The brief holds at most 6 tasks, 4 waits,
3 approvals, 5 rules, 4 where items and 2 owner notes.
Exit codes: 0 done, 2 usage, 3 refused, 4 no session, 5 store needs import or upgrade.
```

### Signatures

```ts
// cli module: each subcommand and the store call it makes
www();                                            // brief.md
www.show(id: ItemID | DecisionID);
www.log(opts: { since?: Since; op?: string[]; id?: string });
www.sessions();
www.init(name: SessionName, opts: { goal: string });
www.attach(name: SessionName);                    // sessions-and-hooks.md
www.detach();
www.import(name: SessionName);                    // store.md, "Import of the hand-kept store"
www.goal(goal: string);
www.now(id: ItemID, next: string);
www.task(id: ItemID, claim: string, opts: { check?: CheckRef; blockedBy?: ItemID });
www.wait(id: ItemID, what: string, opts: { who: string; check?: CheckRef });
www.ok(id: ItemID, opts: { quote: string; who: string; where: string; scope: string; use: 'once' | 'standing' });
www.rule(id: ItemID, text: string);
www.where(id: ItemID, text: string, opts: { check?: CheckRef });
www.set(id: ItemID, claim: string, opts: { check?: CheckRef });   // keeps the kind; a new check replaces the old
www.decide(choice: string, opts: { why: string; on?: ItemID; who?: 'owner' | 'agent'; ruledOut?: boolean; replaces?: DecisionID });
www.done(id: ItemID, opts: { evidence: string });
www.drop(id: ItemID, opts: { why: string });
www.use(id: ItemID, opts: { for: string });       // once approvals only
www.say(text: string, opts: { on?: ItemID });     // owner-notes.md
www.ack(id: OwnerNoteID);
www.install(opts: { print?: boolean });           // sessions-and-hooks.md
www.doctor();
www.hook(harness: 'claude' | 'codex');            // reads the hook payload on stdin

type DecisionID = `d-${number}`; // assigned by decide, from d-1, one past the highest in the journal
type OwnerNoteID = `o-${number}`; // assigned by say, from o-1
type Since = `${number}h` | `${number}d` | `day-${number}`;
```

### Text limits

| Text                                | Limit           |
| ----------------------------------- | --------------- |
| claim (task, wait, rule, where, set) | 120 characters |
| approval quote (`--quote`)          | 120 characters  |
| next step (`now`)                   | 120 characters  |
| goal                                | 200 characters  |
| owner note (`say`)                  | 160 characters  |
| `--why`, `--evidence`, `--for`      | 200 characters  |
| decision (`decide`)                 | 200 characters  |
| `--who`, `--where`                  | 16 characters   |
| `--scope`                           | 40 characters   |

### Write replies

Each write prints one line on stdout and exits 0. `<check>` is `no check`, `no check run` before the checks slice, or `checked now: <result>`; `<n>` is the brief's line count.

| Command                         | Reply                                                                                              |
| ------------------------------- | -------------------------------------------------------------------------------------------------- |
| `task`, `wait`, `rule`, `where`, `ok`, `set` | `<id>  <kind>, open, <check>. Brief: <n> lines.` (a rule has no `<check>` part)       |
| `now`                           | `now: <id>. Brief: <n> lines.`                                                                    |
| `goal`                          | `goal set. Brief: <n> lines.`                                                                     |
| `decide`                        | `d-<n>  decision[ on <id>]. Read it with: www show <id or d-n>. Brief: <n> lines.`                |
| `decide --ruled-out`            | `d-<n>  ruled out[ on <id>]. Read it with: www show <id or d-n>. Brief: <n> lines.`               |
| `done`, `drop`, `use`           | `<id>  done.` or `dropped.` or `used.`, then ` Off the brief, kept in the journal. Brief: <n> lines.` |
| `init`                          | `Started session <name> in <folder>. Bound to this <harness> session.` or, with no agent id, `Started session <name> in <folder>. Name it on each command: www --session <name>` |
| `attach`, `detach`              | `Bound this <harness> session to <name>.` or `Unbound this <harness> session from <name>.`        |
| `import`                        | `Imported <name>: <n> items, <m> journal rows. Originals in <folder>/import-backup/.`             |

Examples from the invented session:

```text
$ www task t-e2e "Write alerts-e2e against staging"
t-e2e  task, open, no check. Brief: 39 lines.

$ www set pr-api-77 "Alert job retries a 503 3 times, 2 s apart; pushed 9b41c07" --pr bosunhq/bosun-api#77
pr-api-77  task, open, checked now: OPEN pending. Brief: 39 lines.

$ www decide "Retry a 503 from the tide feed 3 times, 2 s apart" --why "The feed returns 503 for about 4 s during its hourly refresh" --on pr-api-77
d-23  decision on pr-api-77. Read it with: www show pr-api-77. Brief: 39 lines.

$ www done pr-app-61 --evidence "merged as 51aa0e2, seen by check"
pr-app-61  done. Off the brief, kept in the journal. Brief: 37 lines.

$ www now pr-api-77 "fix the failing lint job on 9b41c07, push, then request review"
now: pr-api-77. Brief: 37 lines.
```

- A write with a check runs that one probe before it replies and stores the result in `at_write`. Before the checks slice, the reply says `no check run` and `at_write` is `-`.
- `www decide --ruled-out` writes a `ruled-out` row in place of `decide`: the choice is the approach, and `--why` is why it lost.
- `www decide --who owner` records a decision the owner made; the default is `agent`.

### www show and www log

```text
$ www show pr-api-77
pr-api-77  task, open since day 7, by agent · check: pr:bosunhq/bosun-api#77
  claim (12m): Alert job retries a 503 3 times, 2 s apart; pushed 9b41c07
  checked now: OPEN failing (oxlint) · at write: OPEN pending
  decisions: d-19 queue the alert in the job, not the request (day 7) · d-23 retry a 503 3 times (day 9)
  journal: day 7 task · day 8 set · day 9 set · day 9 changed

$ www log --op done,decide --since day-9
day 9  10:48  decide    d-23       agent  Retry a 503 from the tide feed 3 times, 2 s apart
                                          why: The feed returns 503 for about 4 s during its hourly refresh
day 9  11:51  done      pr-app-61  agent  Alert settings screen: in review
                                          why: merged as 51aa0e2, seen by check
```

Each `log` row shows the day, the time, the op, the id, who (the `who=` value for a decision, otherwise `by`), the text, and `why:` on its own line when the row has one.

## Refusals

Each refusal exits 3 (exit 4 and 5 where marked), prints its text on stderr, and ends with one or two `Run:` lines. When the tool can fix the call, the `Run:` line is the refused command with each bad value replaced and each missing flag added, so it is complete. When it cannot, such as with no session, a hand-kept store or a decision number it cannot guess, the `Run:` line is the command that gets the agent what the fix needs. A value only the agent knows is a `<placeholder>` that names what goes there. Every other value comes from the agent's command or the store, such as the oldest open task when a kind is full. The examples use the invented session.

| When                                              | The text                                                                                                                                                                                               |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A text is over its limit                          | `www: refused: the claim is 152 characters, and the limit is 120. Write what is true now; the story belongs in a PR or a commit.` `Run: www task t-e2e "<claim of at most 120 characters>"`           |
| A text holds a tab or a newline                   | `www: refused: the text must be one line, with no tab or newline.` `Run: www rule r-sim-port "<one line>"`                                                                                             |
| A kind is full                                    | `www: refused: the brief holds 6 of 6 tasks. Close one, or replace one with www set.` `Run: www done t-e2e --evidence "<PR, commit or test run>"`                                                      |
| `done` has no `--evidence`                        | `www: refused: done needs evidence a reader can open, such as a PR, a commit or a test run. For work you stopped, use drop.` `Run: www done pr-app-61 --evidence "<PR, commit or test run>"`           |
| `drop` has no `--why`                             | `www: refused: drop needs a reason.` `Run: www drop p-sim --why "<reason>"`                                                                                                                            |
| `ok` lacks a part                                 | `www: refused: an approval needs the owner's exact words, who gave them, where, what they cover, and --once or --standing.` `Run: www ok ok-wipe --quote "<their exact words>" --who owner --where terminal --scope "<what it covers>" --once` |
| `wait` has no `--who`                             | `www: refused: a wait names who it waits on.` `Run: www wait w-apns "upload the staging push key" --who "<who>"`                                                                                       |
| `decide` has no `--why`                           | `www: refused: a decision needs its reason.` `Run: www decide "Retry a 503 3 times" --why "<reason>"`                                                                                                  |
| `use` on a standing approval                      | `www: refused: ok-merge is standing, so there is nothing to spend. Act inside its quote and scope.` `Run: www show ok-merge`                                                                           |
| An id names no open item                          | `www: refused: no open item pr-api-78. Open items: pr-api-77, pr-tk-19, t-flag, t-e2e.` `Run: www task pr-api-78 "<claim>"`                                                                            |
| A new item reuses a closed id                     | `www: refused: pr-app-61 closed on day 9. Pick a new id.` `Run: www task <new id> "<claim>"`                                                                                                           |
| A new item reuses an open id of another kind      | `www: refused: r-tk-fork is a rule. Change its text with set, or pick a new id.` `Run: www set r-tk-fork "<claim>"`                                                                                    |
| An id breaks the id rule                          | `www: refused: an id is 2 to 16 characters of a-z, 0-9 and -, starts with a letter, and is not d-<n> or o-<n>.` `Run: www task t-tide-cache "<claim>"`                                                 |
| A text looks like a credential                    | `www: refused: the text looks like a credential (it matches ghp_). Write where the secret lives, never its value.` `Run: www where s-staging "<where the secret lives>"`                               |
| More than one check                               | `www: refused: an item takes one check. Split it into two items.` `Run: www task pr-api-77 "<claim>" --pr bosunhq/bosun-api#77`                                                                        |
| A check reference is malformed                    | `www: refused: --pr takes <owner>/<repo>#<number>, such as bosunhq/bosun-api#77.` `Run: www task pr-api-77 "<claim>" --pr <owner>/<repo>#<number>`                                                     |
| A path or branch check names a relative path      | `www: refused: --path takes an absolute path.` `Run: www where wt-tz "<claim>" --path /home/sam/src/bosun-api/.worktrees/tz-fix`                                                                       |
| A rule has a check                                | `www: refused: a rule has no check. Make the checked thing a where item.` `Run: www where <new id> "<claim>" --path /home/sam/src/bosun-api`                                                             |
| `--blocked-by` names no open task or wait          | `www: refused: --blocked-by w-apn names no open task or wait. Open: w-apns, w-tk, pr-api-77.` `Run: www task t-flag "<claim>" --blocked-by w-apns`                                                    |
| `--replaces` names no decision                    | `www: refused: there is no decision d-40; the last is d-25.` `Run: www log --op decide,ruled-out`                                                                                                      |
| `--replaces` names the owner's decision           | `www: refused: d-4 is the owner's decision. Ask the owner, and record the answer with --who owner.` `Run: www decide "<the owner's answer>" --why "<reason>" --who owner --replaces d-4`              |
| `say` or `ack` from an agent shell                | `www: refused: only the owner writes owner notes, from a terminal outside any agent. Record what the owner told you as a rule, a wait or an approval.` `Run: www rule <id> "<what the owner said, as a rule>"` |
| A third owner note                                | `www: refused: 2 owner notes already show. Clear one that is done.` `Run: www --session tide-alerts ack o-1`                                                                                           |
| `init` names a session that exists               | `www: refused: session tide-alerts exists. Bind this agent session to it.` `Run: www attach tide-alerts`                                                                                               |
| A session name breaks the name rule               | `www: refused: a session name is 2 to 24 characters of a-z, 0-9 and -, and starts with a letter.` `Run: www init tide-alerts --goal "<what done means>"`                                               |
| `attach` names no session                         | `www: refused: no session tide-alert. Sessions: tide-alerts, docs-move.` `Run: www attach tide-alerts`                                                                                                 |
| `attach` or `detach` with no agent session id     | `www: refused: this shell has no agent session id (no CLAUDE_CODE_SESSION_ID or CODEX_SESSION_ID). Name the session on each command.` `Run: www --session tide-alerts`                                 |
| The lock is held for 2 s                          | `www: refused: another write holds the lock on tide-alerts (pid 51022). Try again.` `Run: <the refused command, as typed>`                                                                             |
| No session (exit 4)                               | `www: no session for this agent. Sessions on this machine: tide-alerts (day 9), docs-move (day 2).` `Run: www attach <name>` `Run: www init <name> --goal "<what done means>"`                         |
| The store is hand-kept (exit 5)                   | `www: tide-alerts is a hand-kept store (format 0-by-hand). Convert it first.` `Run: www import tide-alerts`                                                                                           |
| The store's format is newer (exit 5)              | `www: tide-alerts is format 2, and this www reads format 1.` `Run: bun add -g @wherewerewe/cli@latest`                                                                                             |
| Import finds rows that break a rule               | `www: refused: import found 3 rows that break the rules, and wrote nothing.` then one line per row, such as `items.tsv line 9 (r-models): the claim is 151 characters, and the limit is 120.` and `journal.tsv: 6 open waits (q-2, q-4, q-5, q-6, q-7, q-8), and the limit is 4. Close one by appending the tab-separated row: <ts> closed <id> <what settled it>`, then `Run: www import build` |
| An unknown command or flag (exit 2)               | `www: unknown command "taks".` `Run: www help`                                                                                                                                                         |

- The credential test matches at least these: `ghp_`, `gho_`, `ghs_`, `ghu_`, `github_pat_`, `sk-` followed by 20 or more letters and digits, `xoxb-`, `xoxp-`, `AKIA` followed by 16 capitals or digits, `ops_` followed by 20 or more characters, `-----BEGIN`, and a JWT (`eyJ` then two `.`-separated parts).
- When the agent typed `www` with `--session`, each `Run:` line keeps `--session <name>`.

## Constraints

- Once a session is found and its store's format is known, a read is never refused: `www`, `show` and `log` print what they can, even when every check fails. `sessions` needs no session and is never refused.
- `set` on an item whose check changed is never refused: fixing a stale claim is what the brief asks for.
- A write changes only the files its command names in [store.md](store.md); a refused write changes nothing.
- Every refusal text and every `Run:` line is covered by a test that runs the refused command.
- Each `Run:` line, with its placeholders filled in, passes the same validation.

## Decisions

- **`decide` takes no id; the tool numbers decisions.** The hand-kept log already numbers them d-1 upward, and a number the agent picks can clash.
- **`--blocked-by` stays.** The hand-kept store uses `blocked_by` on 3 of its 4 tasks, and the brief shows the blocker in the task's tag.
- **A ruled-out approach is its own journal op.** The Ruled out section of the [handoff skill](https://github.com/zgeoff/skills/blob/main/skills/handoff/SKILL.md) reads it with `www log --op ruled-out`.

## Builder decides

- The argument parser, and the spacing and column widths of `show`, `log` and `sessions`.
- Fuzzy matching for the suggested id in a `Run:` line, such as `w-apns` for `w-apn`.
- The full credential pattern list, beyond the patterns above.
