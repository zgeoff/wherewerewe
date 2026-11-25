# The list command, JSON reads and the goal text

- **Status:** agreed
- **Decision records:** [0009](../../decisions/0009-30-open-tasks-and-a-count-of-the-rest.md), [0020](../../decisions/0020-authority-comes-from-the-owners-own-acts.md)

Three reads that slice 3b adds: `www list <kind>`, which prints every row of a kind the brief can cut; `--json` on the read commands, for hooks and scripts; and `www goal --paste`, which prints a `/goal` text for the owner to paste. The help lines, signatures, text limits, refusals and constraints that every command shares are in [commands.md](commands.md). Build these three from this doc, in the slice named in [build-order.md](build-order.md).

## Contracts

### www list

`www list <kind>` prints every open row of one kind, whole, so the agent reads what the brief cut. Run the command on a cut line of the brief to read what it cut ([brief.md](brief.md#the-cut-order)).

| Kind | Command | Prints |
| --- | --- | --- |
| tasks | `www show` or `www list tasks` | every open task, notes included |
| waits | `www list waits` | every wait |
| the one-time approval | `www list approvals` | the approval, if one is open |
| rules, where rows | `www list rules`, `www list where` | every row of the kind |
| lessons, promises, owner's words | `www list lessons`, `www list promises`, `www list words` | every row of the kind |
| notes | `www list notes` | every open item's note whole, owed first, then newest |
| decisions | `www list decisions` | the decisions in force, newest first; `www log --op decide,ruled-out` keeps the history |
| pull request rows | `www list prs` | the open pull requests no item names |

`www list <kind>` prints every open row of the kind whole, in the brief's order unless the table gives another, with each item's note under it as `www show` prints it. It runs no check, so each tag shows the result the last read saved, and it never takes the lock. It is a subcommand of its own because `www show <word>` reads its argument as an item id, and a task can have any id. `www list` with no kind, or an unknown one, exits 2 with `Run: www list tasks`. A kind with no open row prints its heading with a zero count, such as `RULES (0, max 15)`, `DECISIONS (0 in force)` or `PULL REQUESTS THIS SESSION OPENED THAT NO ITEM NAMES (0)`, and exits 0; `www list notes` with no note prints nothing and exits 0.

```text
$ www list tasks
OPEN (5, max 30)
  pr-api-77   Alert job retries a 503 from the tide feed; pushed 3e1f0aa  [OPEN failing]
    note (1h): The 503s come from the feed's hourly refresh, about 4 s long (d-23). Retry 3 times, 2
    s apart: a longer backoff makes the alert miss its 2-hour window. The lint job fails on an
    unused import in the retry helper, not on the retry logic.
  pr-app-61   Alert settings screen: in review  [MERGED]
  t-flag      Turn on the tide_alerts flag in staging config  [blocked by w-apns · owed]
    owed note (43h): Turn the tide_alerts flag back off in staging config before this closes:
    staging is shared with the harbour team, who demo on Thursday.
  pr-tk-19    tidekit: harmonic constants for harbours south of 60°S  [OPEN pending]
  t-e2e       Write alerts-e2e against staging  [no check · 3d]

$ www list waits
WAITING (2, max 8)
  w-apns      upload the staging push key to the vault  [owner · 2d]
  w-tk        review tidal-org/tidekit#19  [tidekit team · OPEN pending]

$ www list approvals
APPROVED ONCE (1, max 1)
  ok-prod-index  "add the harbour_id index on the prod alerts table, once, after 22:00" · prod alerts table

$ www list rules
RULES (3, max 15)
  r-api-tests Run the API tests from api/; from the repo root the queue tests are skipped
  r-tk-fork   tidekit is a fork here: pass -R tidal-org/tidekit to gh, or the PR opens on the fork
  r-sim-port  Start the app simulator with PORT=8091; 8090 belongs to another session

$ www list where
WHERE (3, max 8)
  wt-tz       bosun-api worktree for the time zone fix, branch tz-fix  [clean]
    note (2d): Remove it with git worktree remove once the tz-fix PR merges; the simulator reads its
    fixtures from there.
  p-sim       app simulator, pid 48211; stop it with kill 48211  [gone]
  s-staging   staging secrets live in the vault bosun-staging; never print a value  [no check · 8d]

$ www list lessons
LESSONS (1, max 5)
  l-seed      Reseed the staging alerts table before alerts-e2e  [why: A stale row made alerts-e2e pass on day 6 while no alert fired]

$ www list promises
PROMISED (1, max 5)
  due-cost    Cost table for the alert fan-out  [to owner · by day 10, before review]

$ www list words
WORDS (2, max 8)
  w-plain     "Plain words in every reply; I would rather read three short sentences than one clever one"  [chat · 6d]
  w-small-prs "Keep each PR small enough that I can review it in one sitting"  [chat · 5d]

$ www list notes
  t-flag      Turn on the tide_alerts flag in staging config
    owed note (43h): Turn the tide_alerts flag back off in staging config before this closes:
    staging is shared with the harbour team, who demo on Thursday.
  pr-api-77   Alert job retries a 503 from the tide feed; pushed 3e1f0aa
    note (1h): The 503s come from the feed's hourly refresh, about 4 s long (d-23). Retry 3 times, 2
    s apart: a longer backoff makes the alert miss its 2-hour window. The lint job fails on an
    unused import in the retry helper, not on the retry logic.
  wt-tz       bosun-api worktree for the time zone fix, branch tz-fix
    note (2d): Remove it with git worktree remove once the tz-fix PR merges; the simulator reads its
    fixtures from there.

$ www list decisions
DECISIONS (6 in force)
  d-23  Retry a 503 from the tide feed 3 times, 2 s apart
  d-21  Read low-water times from the feed, never compute them
  d-20  Store each saved harbour's time zone on the harbour, never on the device
  d-19  queue the alert in the job, not the request
  d-12  Open the alert settings screen from the harbour page, never from the tab bar
  d-7  Read tide times in UTC and convert on the device

$ www list prs
PULL REQUESTS THIS SESSION OPENED THAT NO ITEM NAMES (1)
  bosunhq/bosun-app#64  opened 3h ago  [OPEN]
```

### --json

The five read commands take `--json`: the brief (`www --json`, with or without `--session <name>`), `www show` and `www show <id>`, `www log`, `www list <kind>` and `www recap`. `www sessions` and `www help` take no `--json`, and each refuses it as a flag the command does not take. Text stays the default. Hooks and scripts read the JSON, and the agent reads the text, so the `www` skill and every `Run:` line use the text form. No write command takes `--json`.

- A JSON read that succeeds prints one JSON value and a newline on stdout, and nothing else on stdout. Its stderr is the text form's stderr, such as the line for a `notes.tsv` row that does not parse or for a duplicate id.
- It runs the same checks, takes the same lock, and exits with the same code as its text form. A refusal, exit 4 or exit 5 prints the text form's lines and no JSON.
- The JSON brief is never cut and is outside the brief's limit, because no host puts it in front of a model: it holds every open row whole. The recap's JSON holds its rows whole, with no 100-character cut.
- A cell that is `-` on disk is `null` in every shape. A journal row's `extra` stays the string the journal holds, such as `on=pr-api-77;who=agent`, or `null`.
- `open` holds the items of `items.tsv` in the order their sections print in the text brief, each with its note. Lessons, promises and the owner's words are in their own arrays, so no row appears twice.
- Each item's `last` is the result this read got, as the text brief's tag shows it, whether or not the read could save it. `changed` holds every changed row whole. `next` is `null` whenever the text brief hides the next step.
- `www show grant` with no grant prints one subject, `{ kind: 'grant', row: null }`, with `journal` holding every `grant` row. A closed item, an id with journal rows only, and an id with no row print `"subjects":[]`.
- A recap whose journal cannot be read holds `null` for `writes`, `decidedSince` and `closedSince`, and stderr gives the text form's reason.
- Each string value, an object key included, passes the credential redaction before it is encoded, so the output is always valid JSON.
- Each value carries `v: 1`. A new field keeps the version, and a removed or renamed field raises it.
- `www --json` is a `www` command for the gate, so it passes in every state, but it is not the brief command: the gate never counts it, and `PostToolUse` never counts it as a whole read ([sessions-and-hooks.md](sessions-and-hooks.md#the-gate)). The header and footer contract of [brief.md](brief.md) covers the text form only.

```ts
// --json output of each read command; text stays the default
// Item, Note, JournalRow and ItemID: store.md. LessonRow, PromiseRow, WordsRow, PrRow: store.md
// GrantOpts, DecisionID, OwnerNoteID and ListKind: the signatures in commands.md
type Shown =
  | { kind: Kind; row: Item; note: Note | null }
  | { kind: 'lesson'; row: LessonRow; note: null }
  | { kind: 'promise'; row: PromiseRow; note: null }
  | { kind: 'words'; row: WordsRow; note: null };

interface BriefJson {
  v: 1;
  session: string;
  day: number;
  host: 'claude' | 'codex' | 'none'; // the reader's host, as brief.md finds it
  limit: { bytes: number; tokens: number }; // the text brief's limit on that host
  estimate: number; // estimated tokens of the text brief, as the write reply gives
  goal: string;
  grant: GrantOpts | null;
  ownerNotes: { id: OwnerNoteID; text: string; said: string; on: ItemID | null }[]; // the rows of owner.tsv
  words: WordsRow[];
  changed: { id: ItemID; was: string; now: string }[];
  focus: ItemID | null; // the item NOW names
  next: string | null;
  open: Shown[]; // the items of items.tsv in the order their sections print, none cut, each with its note
  lessons: LessonRow[];
  promises: PromiseRow[];
  decisions: JournalRow[]; // the decisions in force, newest first
  prs: PrRow[]; // the open pull requests no item names
}

// show <id> takes an item id, a lesson, promise or words id, 'grant' or a decision id
type ShowSubject =
  | (Shown & { checkedNow: string | null; failingChecks: string[]; decisions: DecisionID[] }) // failingChecks: the names show prints after OPEN failing, redacted as the text form is; [] otherwise
  | { kind: 'grant'; row: GrantOpts | null } // null: the session has no grant
  | { kind: 'decision'; row: JournalRow };

interface ShowJson {
  v: 1;
  // show <id>: one subject, with its journal rows; show with no id: every open task, as the text form lists them, journal null
  subjects: (ShowSubject & { journal: JournalRow[] | null })[];
}

interface LogJson {
  v: 1;
  rows: JournalRow[]; // after --since, --op and --id, oldest first
}

type ListJson = { v: 1 } & (
  | { kind: 'decisions'; rows: JournalRow[] }
  | { kind: 'prs'; rows: PrRow[] }
  | { kind: 'notes'; rows: Note[] }
  | { kind: Exclude<ListKind, 'decisions' | 'prs' | 'notes'>; rows: Shown[] }
);

interface RecapJson {
  v: 1;
  session: string;
  day: number;
  since: string; // the time the recap starts from
  writes: number | null; // null: the journal cannot be read
  grant: GrantOpts | null;
  promises: PromiseRow[];
  notes: { item: Shown; note: Note }[]; // every open item with a note, owed first, then newest
  otherOpen: ItemID[];
  decidedSince: JournalRow[] | null; // null: the journal cannot be read
  closedSince: JournalRow[] | null;
}
```

```text
$ www list rules --json
{"v":1,"kind":"rules","rows":[{"kind":"rule","row":{"id":"r-api-tests","kind":"rule","claim":"Run the API tests from api/; from the repo root the queue tests are skipped","check":null,"atWrite":null,"last":null,"written":"2026-03-03T10:20:00Z","by":"agent","extra":{}},"note":null},{"kind":"rule","row":{"id":"r-tk-fork","kind":"rule","claim":"tidekit is a fork here: pass -R tidal-org/tidekit to gh, or the PR opens on the fork","check":null,"atWrite":null,"last":null,"written":"2026-03-05T14:02:11Z","by":"agent","extra":{}},"note":null},{"kind":"rule","row":{"id":"r-sim-port","kind":"rule","claim":"Start the app simulator with PORT=8091; 8090 belongs to another session","check":null,"atWrite":null,"last":null,"written":"2026-03-09T08:12:40Z","by":"agent","extra":{}},"note":null}]}
```

A schema test pins each type, so a removed or renamed field fails until `v` changes with it, and a new field fails until the schema adds it.

### www goal --paste

`www goal --paste` prints the `/goal` text of the grant, for the owner to copy whole and paste. It takes no argument, and a goal text beside it is refused. `www goal "<what done means>"` still sets the session's goal.

```text
$ www --session tide-alerts goal --paste
  may    • merge the alert PRs once CI is green and every review finding is answered
         • deploy either app to staging whenever you need to
         • wipe or reseed the staging alerts table as often as you like
         • open PRs on tidal-org/tidekit from our fork
  not    • the prod database
  never  • the prod push certificate  • publishing a tidekit release
  scope  in bosun-api, bosun-app and tidekit
Run www --session tide-alerts and deliver all the work in it.
```

- The text is the grant's bullets under `may`, `not` and `never`, in the owner's words as the brief prints them, then the scope when the grant has one, then one line: `Run www --session <name> and deliver all the work in it.`
- It prints no reading, no session goal and nothing else of the brief. It reads only the `session` file, runs no check and never takes the lock.
- With no grant, it refuses with a `Run: www grant` line.
- The worst-case grant of [brief.md](brief.md) prints in 1,013 characters, and the text stays under 1,100, far under the 4,000-character limit of a `/goal`. The session's limits hold the text under that bound, so it is never cut and never refused for its length.
- It reads only `session`, and exits 3, 4 or 5 as every read does on a store it cannot read.
- The owner's paste carries the authority, and the tool's printing carries none ([sessions-and-hooks.md](sessions-and-hooks.md#the-injected-grant-authorises-nothing)). A `/goal` condition kept a permission before a compaction and lost it after one. After a compaction, the grant reaches the classifier again only when the agent restates it in its next summary, from the words the `SessionStart` hook injects.

## Constraints

- The constraints of [commands.md](commands.md#constraints) apply to each command here: a well-formed read is never refused for what it finds in a format 2 store, and a read with `--json` exits with the code its text form gives.

## Decisions

- **`www list <kind>` is a subcommand of its own.** `www show <word>` reads its argument as an item id, so a kind word would collide with an id. [0009](../../decisions/0009-30-open-tasks-and-a-count-of-the-rest.md)
- **Only the read commands take `--json`.** Text stays the default, because the agent reads the text and a script reads the JSON.
- **Authority comes from the owner's own acts.** `www goal --paste` prints a text for the owner to paste, and the tool's printing carries none. [0020](../../decisions/0020-authority-comes-from-the-owners-own-acts.md)
