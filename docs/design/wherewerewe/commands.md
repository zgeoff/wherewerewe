# The commands

- **Status:** agreed
- **Decision records:** [0008](../../decisions/0008-notes-the-grant-and-no-caution-steering.md), [0009](../../decisions/0009-30-open-tasks-and-a-count-of-the-rest.md), [0011](../../decisions/0011-a-grant-of-limits-and-its-lines.md), [0012](../../decisions/0012-a-capped-heading-names-its-max.md), [0016](../../decisions/0016-the-brief-limit-is-20000-tokens-or-the-host-limit.md), [0017](../../decisions/0017-a-lesson-is-a-kind-of-its-own.md), [0018](../../decisions/0018-a-promise-is-a-kind-of-its-own.md), [0019](../../decisions/0019-the-owners-words-are-a-kind-of-their-own.md), [0020](../../decisions/0020-authority-comes-from-the-owners-own-acts.md)

`www` is one command with a subcommand per write. Every write answers in one line, and that line ends with the brief's estimated tokens, so the agent sees what each write costs; the session and import commands in the reply table are the exceptions. `now` and each close print the item's note before that line, and a claim write that keeps an older note prints the older-note line before it, so the reply always ends on that line. Every refusal prints a command to run next: the fixed call when the tool can fix it, or else the command that shows what the fix needs. Build the command-line parser, the write replies, the refusals and `www recap` from this doc, in the slice from [build-order.md](build-order.md).

## Contracts

### www help

`www help` prints this text, as built through slice 3b but for the two lines the last diff below adds, decision records 0009, 0011 and 0016 to 0019, and the limits' diff, and `www --help` and `www -h` do the same. The lines below are fixed, spacing included: a test compares the block with the tool's output character for character.

```text
www (wherewerewe): what is true now in one long agent session, in one short brief.

Read. Run www first, after every compaction, and whenever you are unsure:
  www                        the brief: goal, grant, owner notes and words, what changed, now and
                             its note, open work, waits, promises, the approval, rules, lessons,
                             decisions, where things are. Runs checks.
  www show [<id>]            one item, decision or the grant (www show grant): its text, its note,
                             its check now, its journal rows. With no id, every open task in full
  www log [--since <t>] [--op <op,...>] [--id <id>]
                             the journal, oldest first. <t> is 24h, 3d or day-7
  www sessions               every session on this machine
  www list <tasks|waits|approvals|rules|where|lessons|promises|words|notes|decisions|prs>
                             every row of one kind, whole, as the brief prints it
  www recap [--since <t>]    one screen for the owner: grant, notes, promises, decisions, closes

Write as you go. One id holds one claim and one note; --note replaces the note:
  www now <id> "<next step>" [--note "<detail>" [--owed]]
  www task <id> "<claim>" [<check>] [--blocked-by <id>] [--note "<detail>" [--owed]]
  www wait <id> "<what>" --who <who> [<check>]
  www ok <id> --quote "<their exact words>" --who <who> --where <where> --scope "<scope>"
  www rule <id> "<do it this way, and why>"
  www lesson <id> "<do this>" --why "<the mistake behind it>"
  www promise <id> "<what>" --to <who> --by <when>
  www words <id> "<the owner's exact words>" --where <where>
  www where <id> "<what and where, and how to stop it>" [<check>]
  www set <id> ["<claim>"] [<check>] [--note "<detail>" [--owed] | --no-note]
  www decide "<choice>" --why "<reason>" [--on <id>] [--who owner] [--ruled-out] [--replaces d-<n>]
  www goal "<what done means>"
  www grant [--may "<words>"] [--not "<words>"] [--never "<words>"] [--scope "<scope>"]
            --where <where> --reading "<what they cover; what the owner kept back>"
  www grant --reading "<what they cover; what the owner kept back>"

Notes: --note "<detail>" and --owed work on now and on every task, wait, approval, rule and where
write, and not on a lesson, a promise or the owner's words. A note holds what you need on your
next turn to that item. An owed note stops done, drop and use until set clears it.
Grant: --may, --not and --never repeat, one bullet each, in the owner's words; a grant needs one.

Close. Each leaves the brief and stays in the journal. A lesson or the owner's words close with
drop only:
  www done <id> --evidence "<PR, commit or test run>"
  www drop <id> --why "<reason>"
  www use <id> --for "<what you did with it>"     spend the one-time approval

Checks, one per item: --pr <owner>/<repo>#<n>  --branch <repo path>@<branch>  --path <path>  --pid <n>

Owner, from a terminal outside any agent:  www say "<text>" [--on <id>]   www ack o-<n>

Session: www init <name> --goal "<goal>"   www attach <name>   www detach   www import <name>
Setup:   www install [--print]   www doctor
Any command takes --session <name>.

Limits: a claim is one line of at most 120 characters, a note 400, a goal 200, a next step 120,
a decision 200 with its --why 200, an owner note 160, and a close --why, --evidence or --for 200.
An id has 2 to 16 characters, a session name 2 to 24. An approval takes --quote 120, --who 16,
--where 16 and --scope 40, and a wait takes --who 16. The grant's words come to 700 in at most
12 bullets on at most 19 lines of the brief, with --scope 40, --where 16 and a reading of 200.
A lesson takes 120 with its --why 200, a promise 120 with --to 16 and --by 24, and the owner's
words 300 with --where 16. A session holds at most 30 tasks, 8 waits, 1 approval, 15 rules,
8 where items, 5 lessons, 5 promises, 8 owner's words and 2 owner notes.
Exit codes: 0 done, 2 usage, 3 refused, 4 no session, 5 store needs import or upgrade.
```

The block above is the help as built through slice 3b but for two lines, decision records 0009, 0011 and 0016 to 0019, and the limits' diff, and the test compares the tool's output with it. The slice 2b, 2c and 2d diffs, the task limit's diff, the grant's diff and the limits' diff below are what each changed up to slice 2d, and the last diff adds the two lines slice 3b leaves. Apply each diff to the block as the slice before it left it: `-` marks a line taken out, `+` a line put in, a line with neither is unchanged, and each `@@` line gives the line numbers in the block before and after.

Slice 2b, notes:

```diff
@@ -10,5 +10,5 @@
 
-Write as you go. One id holds one claim, and each write replaces it:
-  www now <id> "<next step>"
-  www task <id> "<claim>" [<check>] [--blocked-by <id>]
+Write as you go. One id holds one claim and one note; --note replaces the note:
+  www now <id> "<next step>" [--note "<detail>" [--owed]]
+  www task <id> "<claim>" [<check>] [--blocked-by <id>] [--note "<detail>" [--owed]]
   www wait <id> "<what>" --who <who> [<check>]
@@ -17,3 +17,3 @@
   www where <id> "<what and where, and how to stop it>" [<check>]
-  www set <id> "<claim>" [<check>]
+  www set <id> ["<claim>"] [<check>] [--note "<detail>" [--owed] | --no-note]
   www decide "<choice>" --why "<reason>" [--on <id>] [--who owner] [--ruled-out] [--replaces d-<n>]
@@ -21,2 +21,5 @@
 
+Notes: --note "<detail>" and --owed work on now and on every item write. A note holds what you
+need on your next turn to that item. An owed note stops done, drop and use until set clears it.
+
 Close. Each leaves the brief and stays in the journal:
@@ -34,4 +37,4 @@
 
-Limits: a claim is one line of at most 120 characters. The brief holds at most 6 tasks, 4 waits,
-3 approvals, 5 rules, 4 where items and 2 owner notes.
+Limits: a claim is one line of at most 120 characters, a note 400. The brief holds at most 6 tasks,
+4 waits, 3 approvals, 5 rules, 4 where items and 2 owner notes.
 Exit codes: 0 done, 2 usage, 3 refused, 4 no session, 5 store needs import or upgrade.
```

Slice 2c, the grant and format 2:

```diff
@@ -3,5 +3,6 @@
 Read. Run www first, after every compaction, and whenever you are unsure:
-  www                        the brief: goal, owner notes, what changed, now, open work, waits,
-                             approvals, rules, where things are. Runs every check.
-  www show <id>              one item or decision: its claim, its check now, its journal rows
+  www                        the brief: goal, grant, owner notes, what changed, now and its note,
+                             open work, waits, the approval, rules, where things are. Runs checks.
+  www show <id>              one item, decision or the grant (www show grant): its text, its note,
+                             its check now, its journal rows
   www log [--since <t>] [--op <op,...>] [--id <id>]
@@ -14,3 +15,3 @@
   www wait <id> "<what>" --who <who> [<check>]
-  www ok <id> --quote "<their exact words>" --who <who> --where <where> --scope "<scope>" (--once | --standing)
+  www ok <id> --quote "<their exact words>" --who <who> --where <where> --scope "<scope>"
   www rule <id> "<do it this way, and why>"
@@ -20,2 +21,5 @@
   www goal "<what done means>"
+  www grant --may "<words>" [--not "<words>"] [--never "<words>"] [--scope "<scope>"]
+            --where <where> --reading "<what they cover; what the owner kept back>"
+  www grant --reading "<what they cover; what the owner kept back>"
 
@@ -23,2 +27,3 @@
 need on your next turn to that item. An owed note stops done, drop and use until set clears it.
+Grant: --may, --not and --never repeat, one bullet each, in the owner's words.
 
@@ -27,3 +32,3 @@
   www drop <id> --why "<reason>"
-  www use <id> --for "<what you did with it>"     spend a --once approval
+  www use <id> --for "<what you did with it>"     spend the one-time approval
 
@@ -37,4 +42,5 @@
 
-Limits: a claim is one line of at most 120 characters, a note 400. The brief holds at most 6 tasks,
-4 waits, 3 approvals, 5 rules, 4 where items and 2 owner notes.
+Limits: a claim is one line of at most 120 characters, a note 400, a grant bullet 120, the grant's
+words 700 in at most 12 bullets, and its reading 200. The brief holds at most 6 tasks, 4 waits,
+1 approval, 5 rules, 4 where items and 2 owner notes.
 Exit codes: 0 done, 2 usage, 3 refused, 4 no session, 5 store needs import or upgrade.
```

Slice 2d, recap:

```diff
@@ -10,2 +10,3 @@
   www sessions               every session on this machine
+  www recap [--since <t>]    one screen for the owner: the grant, notes, decisions, what closed
 
```

The task limit, decision record 0009:

```diff
@@ -5,4 +5,4 @@
                               open work, waits, the approval, rules, where things are. Runs checks.
-  www show <id>              one item, decision or the grant (www show grant): its text, its note,
-                             its check now, its journal rows
+  www show [<id>]            one item, decision or the grant (www show grant): its text, its note,
+                             its check now, its journal rows. With no id, every open task in full
   www log [--since <t>] [--op <op,...>] [--id <id>]
@@ -44,3 +44,3 @@
 Limits: a claim is one line of at most 120 characters, a note 400, a grant bullet 120, the grant's
-words 700 in at most 12 bullets, and its reading 200. The brief holds at most 6 tasks, 4 waits,
+words 700 in at most 12 bullets, and its reading 200. A session holds at most 30 tasks, 4 waits,
 1 approval, 5 rules, 4 where items and 2 owner notes.
```

The grant's shapes and its lines, decision record 0011:

```diff
@@ -23,1 +23,1 @@
-  www grant --may "<words>" [--not "<words>"] [--never "<words>"] [--scope "<scope>"]
+  www grant [--may "<words>"] [--not "<words>"] [--never "<words>"] [--scope "<scope>"]
@@ -29,1 +29,1 @@
-Grant: --may, --not and --never repeat, one bullet each, in the owner's words.
+Grant: --may, --not and --never repeat, one bullet each, in the owner's words; a grant needs one.
@@ -44,3 +44,3 @@
-Limits: a claim is one line of at most 120 characters, a note 400, a grant bullet 120, the grant's
-words 700 in at most 12 bullets, and its reading 200. A session holds at most 30 tasks, 4 waits,
-1 approval, 5 rules, 4 where items and 2 owner notes.
+Limits: a claim is one line of at most 120 characters, a note 400, the grant's words 700 in at most
+12 bullets on at most 19 lines of the brief, and its reading 200. A session holds at most 30 tasks,
+4 waits, 1 approval, 5 rules, 4 where items and 2 owner notes.
```

The limits' diff adds every limit the code enforces to the help, so an agent can read each one before a write refuses it:

```diff
@@ -44,3 +44,6 @@
-Limits: a claim is one line of at most 120 characters, a note 400, the grant's words 700 in at most
-12 bullets on at most 19 lines of the brief, and its reading 200. A session holds at most 30 tasks,
-4 waits, 1 approval, 5 rules, 4 where items and 2 owner notes.
+Limits: a claim is one line of at most 120 characters, a note 400, a goal 200, a next step 120,
+a decision 200 with its --why 200, an owner note 160, and a close --why, --evidence or --for 200.
+An id has 2 to 16 characters, a session name 2 to 24. An approval takes --quote 120, --who 16,
+--where 16 and --scope 40, and a wait takes --who 16. The grant's words come to 700 in at most
+12 bullets on at most 19 lines of the brief, with --scope 40, --where 16 and a reading of 200.
+A session holds at most 30 tasks, 4 waits, 1 approval, 5 rules, 4 where items and 2 owner notes.
```

#### After slice 3b

In slice 3b, add these two lines to the block above, with the code and the test, in the same pull request. Apply this diff to the block to add `--json` on the read commands and the printed goal, decision record 0020:

```diff
@@ -14,2 +14,3 @@
   www recap [--since <t>]    one screen for the owner: grant, notes, promises, decisions, closes
+Read commands take --json: one JSON value for a script, in place of the text.
 
@@ -28,2 +29,3 @@
   www goal "<what done means>"
+  www goal --paste           print a /goal text of the grant, for the owner to paste
   www grant [--may "<words>"] [--not "<words>"] [--never "<words>"] [--scope "<scope>"]
```

### Signatures

```ts
// cli module: each subcommand and the store call it makes
www(opts?: ReadOpts);                             // brief.md
www.show(id?: ItemID | DecisionID | 'grant', opts?: ReadOpts); // no id: every open task; an id of any kind, lessons, promises and the owner's words included
www.log(opts: { since?: Since; op?: string[]; id?: string } & ReadOpts);
www.list(kind: ListKind, opts?: ReadOpts);        // every row of one kind
www.recap(opts: { since?: Since } & ReadOpts);    // default 24h
www.sessions();
www.init(name: SessionName, opts: { goal: string });
www.attach(name: SessionName);                    // sessions-and-hooks.md
www.detach();
www.import(name: SessionName, opts: Partial<GrantOpts> & { drop?: ItemID[] }); // store.md
www.goal(goal: string);
www.goalPaste();                                  // prints the /goal text of the grant
www.grant(opts: GrantOpts | { reading: string });
www.now(id: ItemID, next: string, opts: NoteOpts);
www.task(id: ItemID, claim: string, opts: { check?: CheckRef; blockedBy?: ItemID } & NoteOpts);
www.wait(id: ItemID, what: string, opts: { who: string; check?: CheckRef } & NoteOpts);
www.ok(id: ItemID, opts: { quote: string; who: string; where: string; scope: string } & NoteOpts);
www.rule(id: ItemID, text: string, opts: NoteOpts);
www.lesson(id: ItemID, text: string, opts: { why: string });
www.promise(id: ItemID, what: string, opts: { to: string; by: string });
www.words(id: ItemID, words: string, opts: { where: string });
www.where(id: ItemID, text: string, opts: { check?: CheckRef } & NoteOpts);
www.set(id: ItemID, claim: string | null, opts: { check?: CheckRef; noNote?: boolean } & NoteOpts); // keeps the kind; a new check replaces the old
www.decide(choice: string, opts: { why: string; on?: ItemID; who?: 'owner' | 'agent'; ruledOut?: boolean; replaces?: DecisionID });
www.done(id: ItemID, opts: { evidence: string });
www.drop(id: ItemID, opts: { why: string });
www.use(id: ItemID, opts: { for: string });
www.say(text: string, opts: { on?: ItemID });     // owner-notes.md
www.ack(id: OwnerNoteID);
www.install(opts: { print?: boolean });           // sessions-and-hooks.md
www.doctor();
www.hook(harness: 'claude' | 'codex');            // reads the hook payload on stdin

// a grant has at least one bullet in may, not or never
interface GrantOpts {
  may?: string[]; // one bullet per --may, in the owner's words
  not?: string[]; // one bullet per --not
  never?: string[]; // one bullet per --never
  scope?: string; // where the grant applies, in the owner's words
  where: string;
  reading: string;
}

interface NoteOpts {
  note?: string; // replaces the item's note
  owed?: boolean; // only with note
}

interface ReadOpts {
  json?: boolean; // one JSON value in place of the text; see --json
}

type ListKind =
  | 'tasks' | 'waits' | 'approvals' | 'rules' | 'where'
  | 'lessons' | 'promises' | 'words' | 'notes' | 'decisions' | 'prs';

type DecisionID = `d-${number}`; // assigned by decide, from d-1, one past the highest in the journal
type OwnerNoteID = `o-${number}`; // assigned by say, from o-1
type Since = `${number}h` | `${number}d` | `day-${number}`;
```

- `set` with no claim changes only the note: it keeps the claim, its check, `at_write` and `written`, and runs no probe. A check belongs to a claim, so `set` with a check and no claim gets the refusal below, with or without `--note`.
- A write without `--note` keeps the item's note. `--no-note` clears it.
- `www grant` with any of `--may`, `--not` and `--never` replaces the whole grant at once: every bullet, the scope, where the words were given and the reading. Each `--may`, `--not` and `--never` holds one bullet in the owner's words, and the brief prints the bullets of each group in the order typed. `--scope` is optional, and a grant needs at least one bullet. `www grant --reading` alone replaces only the reading.
- `www grant` runs from any shell. Its journal row has `by=owner` when the terminal test in [owner-notes.md](owner-notes.md) passes, and `by=agent` otherwise.
- `ok` accepts `--once` and ignores it, because every approval is one-time. `--standing` gets the refusal below.
- `www lesson`, `www promise` and `www words` write only their own file and the journal. A write with an id that holds a lesson, a promise or the owner's words of that kind replaces it. `done` refuses a lesson and the owner's words, and `drop` closes any of the three.
- `www goal --paste` takes no argument, and a goal text beside it is refused ([www goal --paste](lists-and-json.md#www-goal---paste)).
- `www import` takes the grant's flags and `--drop` only to convert a store; `--drop` repeats once per id. See [store.md](store.md) for when each is needed.
- `www detach` from a session whose store is format 1 exits 5 and keeps the binding, and `www init <name>` exits 5 when `<name>` holds a format 1 store, with the format 1 text above in place of the `session exists` refusal. `install` and `doctor` are in the help, and they and `hook` exit 2 until slice 4 builds them; a bound session's `www` prints the same text, and the gate opens on the next call ([sessions-and-hooks.md](sessions-and-hooks.md)).

### Text limits

| Text                                | Limit           |
| ----------------------------------- | --------------- |
| claim (task, wait, rule, where, set) | 120 characters |
| approval quote (`ok --quote`)       | 120 characters  |
| next step (`now`)                   | 120 characters  |
| note (`--note`)                     | 400 characters  |
| goal                                | 200 characters  |
| a grant bullet (`--may`, `--not`, `--never`) | no limit of its own; the words row bounds it, after each line break becomes a space |
| the grant's scope (`--scope`)       | 40 characters, after each line break becomes a space |
| the grant's words: every bullet and the scope | 700 characters, in at most 12 bullets on at most 19 lines of the brief |
| the grant's reading (`--reading`)   | 200 characters  |
| owner note (`say`)                  | 160 characters  |
| `--why` (decision, close, lesson), `--evidence`, `--for` | 200 characters |
| decision (`decide`)                 | 200 characters  |
| lesson instruction (`lesson`)       | 120 characters  |
| promise text (`promise`)            | 120 characters  |
| `--to` (`promise`)                  | 16 characters   |
| `--by` (`promise`)                  | 24 characters   |
| the owner's words (`words`)         | 300 characters  |
| `--who`, `--where`                  | 16 characters   |
| `--scope`                           | 40 characters   |

### Write replies

Each write prints the note lines or the older-note line in its row first and its status line last, and exits 0. A status line ends in `Brief: <t> of <limit> tokens.`, except the replies of `init`, `attach`, `detach` and `import`, whose rows give their whole reply. `<check>` is `no check` or `checked now: <result>`, where `<result>` can be `unchecked`; `<t>` is the estimate of the brief rendered from the store as the write saved it, with each check's saved result and no probe, and `<limit>` the reader's host's limit in estimated tokens ([brief.md](brief.md#the-briefs-limit)). `<note lines>` are the item's note, wrapped and indented 4 as the brief prints it ([brief.md](brief.md)).

| Command                         | Reply                                                                                              |
| ------------------------------- | -------------------------------------------------------------------------------------------------- |
| `task`, `wait`, `rule`, `where`, `ok`, `set` | `<id>  <kind>, open, <check>[, note <k> of 400[, owed]]. Brief: <t> of <limit> tokens.` (a rule has no `<check>` part; the note part shows when the command wrote a note) |
| the same, when the write replaces the claim and keeps a note written before it | `  its note is <age> older than this claim. Replace it with www set <id> --note "<detail>", or clear it with www set <id> --no-note`, then the line above |
| `lesson`                        | `<id>  lesson, open, why <k> of 200. Brief: <t> of <limit> tokens.`                                  |
| `promise`                       | `<id>  promise to <who>, by <when>. Brief: <t> of <limit> tokens.`                                    |
| `words`                         | `<id>  owner's words, open, <k> of 300. Brief: <t> of <limit> tokens.`                                |
| `set` with only `--note`        | `<id>  note, <k> of 400[, owed]. Brief: <t> of <limit> tokens.`                                               |
| `set --no-note`                 | `<id>  note cleared. Brief: <t> of <limit> tokens.`                                                           |
| `now`                           | `now: <id>. Brief: <t> of <limit> tokens.`, or, when the item has a note, `<note lines>`, then `now: <id>, with its note (<age>). Brief: <t> of <limit> tokens.` or `with its owed note (<age>)` |
| `goal`                          | `goal set. Brief: <t> of <limit> tokens.`                                                                     |
| `grant` with a bullet           | `grant: <k> of 700 characters in <b> of 12 bullets on <l> of 19 lines, reading <m> of 200. Brief: <t> of <limit> tokens.` |
| `grant --reading`               | `grant reading: <m> of 200. Brief: <t> of <limit> tokens.`                                                     |
| `decide`                        | `d-<n>  decision[ on <id>]. Read it with: www show <id or d-n>. Brief: <t> of <limit> tokens.`                |
| `decide --ruled-out`            | `d-<n>  ruled out[ on <id>]. Read it with: www show <id or d-n>. Brief: <t> of <limit> tokens.`               |
| `done`, `drop`, `use`           | `<id>  done.` or `dropped.` or `used.`, then ` Off the brief, kept in the journal. Brief: <t> of <limit> tokens.`, or, when the item had a note, first `<note lines>`, then the same line with ` Off the brief, kept in the journal with its note (<age>). Brief: <t> of <limit> tokens.` |
| `init`                          | `Started session <name> in <folder>. Bound to this <harness> session.` or, with no agent id, `Started session <name> in <folder>. Name it on each command: www --session <name>` |
| `attach`, `detach`              | `Bound this <harness> session to <name>.` or `Unbound this <harness> session from <name>.`        |
| `import` of a hand-kept store   | `Imported <name>: <n> items, <m> journal rows. Originals in <folder>/import-backup/.`             |
| `import` of a format 1 store    | `Upgraded <name> to format 2: grant <k> of 700 characters, <s> standing approvals folded into it, <o> one-time approval kept. Originals in <folder>/format-1-backup/.` or `no grant` in place of the grant part; then each removed note as `  <id> had a note: <note>` |

Examples from the invented session:

```text
$ www task t-e2e "Write alerts-e2e against staging"
t-e2e  task, open, no check. Brief: 1165 of 8000 tokens.

$ www task t-flag "Turn on the tide_alerts flag in staging config" --blocked-by w-apns --note "Turn the tide_alerts flag back off in staging config before this closes: staging is shared with the harbour team, who demo on Thursday." --owed
t-flag  task, open, no check, note 135 of 400, owed. Brief: 1195 of 8000 tokens.

$ www set pr-api-77 "Alert job retries a 503 3 times, 2 s apart; pushed 9b41c07" --pr bosunhq/bosun-api#77
  its note is 1h older than this claim. Replace it with www set pr-api-77 --note "<detail>", or clear it with www set pr-api-77 --no-note
pr-api-77  task, open, checked now: OPEN pending. Brief: 1196 of 8000 tokens.

$ www decide "Retry a 503 from the tide feed 3 times, 2 s apart" --why "The feed returns 503 for about 4 s during its hourly refresh" --on pr-api-77
d-23  decision on pr-api-77. Read it with: www show pr-api-77. Brief: 1198 of 8000 tokens.

$ www done pr-app-61 --evidence "merged as 51aa0e2, seen by check"
pr-app-61  done. Off the brief, kept in the journal. Brief: 1177 of 8000 tokens.

$ www now pr-api-77 "fix the failing lint job on 9b41c07, push, then request review"
    The 503s come from the feed's hourly refresh, about 4 s long (d-23). Retry 3 times, 2 s apart: a
    longer backoff makes the alert miss its 2-hour window. The lint job fails on an unused import in
    the retry helper, not on the retry logic.
now: pr-api-77, with its note (1h). Brief: 1184 of 8000 tokens.

$ www grant --reading "covers merges in both repos on green CI with findings answered, staging deploys, the staging alerts table, opening tidekit PRs; kept back: prod push cert, prod database, tidekit merges and releases"
grant reading: 197 of 200. Brief: 1188 of 8000 tokens.

$ www lesson l-seed "Reseed the staging alerts table before alerts-e2e" --why "A stale row made alerts-e2e pass on day 6 while no alert fired"
l-seed  lesson, open, why 62 of 200. Brief: 1239 of 8000 tokens.

$ www words w-plain "Plain words in every reply; I would rather read three short sentences than one clever one" --where chat
w-plain  owner's words, open, 89 of 300. Brief: 1279 of 8000 tokens.

$ www promise due-cost "Cost table for the alert fan-out" --to owner --by "day 10, before review"
due-cost  promise to owner, by day 10, before review. Brief: 1315 of 8000 tokens.
```

- A write with a check runs that one probe before it replies and stores the result in `at_write`. An `unchecked` result stores `-`.
- `www decide --ruled-out` writes a `ruled-out` row in place of `decide`: the choice is the approach, and `--why` is why it lost.
- `www decide --who owner` records a decision the owner made; the default is `agent`.
- A `now` or a close prints the note whole, every time, so the agent meets it when it turns to the item and when it leaves it.

### www show and www log

`show <id>` runs the item's probe and saves nothing. After `OPEN failing` it names the failing checks in parentheses, as the example's `checked now: OPEN failing (oxlint)` does.

```text
$ www show pr-api-77
pr-api-77  task, open since day 7, by agent · check: pr:bosunhq/bosun-api#77
  claim (12m): Alert job retries a 503 3 times, 2 s apart; pushed 9b41c07
  note (1h): The 503s come from the feed's hourly refresh, about 4 s long (d-23). Retry 3 times, 2 s
    apart: a longer backoff makes the alert miss its 2-hour window. The lint job fails on an unused
    import in the retry helper, not on the retry logic.
  checked now: OPEN failing (oxlint) · at write: OPEN pending
  decisions: d-19 queue the alert in the job, not the request (day 7) · d-23 retry a 503 3 times (day 9)
  journal: day 7 task · day 8 set · day 9 set · day 9 note · day 9 changed · day 9 set

$ www show
OPEN (4, max 30)
  pr-api-77   Alert job retries a 503 3 times, 2 s apart; pushed 9b41c07  [OPEN failing]
    note (1h): The 503s come from the feed's hourly refresh, about 4 s long (d-23). Retry 3 times, 2
    s apart: a longer backoff makes the alert miss its 2-hour window. The lint job fails on an
    unused import in the retry helper, not on the retry logic.
  t-flag      Turn on the tide_alerts flag in staging config  [blocked by w-apns · owed]
    owed note (2d): Turn the tide_alerts flag back off in staging config before this closes: staging
    is shared with the harbour team, who demo on Thursday.
  pr-tk-19    tidekit: harmonic constants for harbours south of 60°S  [OPEN pending]
  t-e2e       Write alerts-e2e against staging  [no check · 3d]

$ www show grant
grant  from the owner in chat · in bosun-api, bosun-app and tidekit
  words (7d), set on day 2 by agent:
  may    • merge the alert PRs once CI is green and every review finding is answered
         • deploy either app to staging whenever you need to
         • wipe or reseed the staging alerts table as often as you like
         • open PRs on tidal-org/tidekit from our fork
  not    • the prod database
  never  • the prod push certificate  • publishing a tidekit release
  reading (12m), set on day 9: covers merges in both repos on green CI with findings answered,
    staging deploys, the staging alerts table, opening tidekit PRs; kept back: prod push cert, prod
    database, tidekit merges and releases
  journal: day 2 grant · day 9 grant

$ www log --op done,decide --since day-9
day 9  10:48  decide    d-23       agent  Retry a 503 from the tide feed 3 times, 2 s apart
                                          why: The feed returns 503 for about 4 s during its hourly refresh
day 9  11:51  done      pr-app-61  agent  Alert settings screen: in review
                                          why: merged as 51aa0e2, seen by check
```

- Each `log` row shows the day, the time, the op, the id, who (the `who=` value for a decision, otherwise `by`), the text, and `why:` on its own line when the row has one.
- A `grant` row prints its text as [store.md](store.md) keeps it, the bullets and scope in one line, and labels its second line `reading:` in place of `why:`.
- A `note` row with `owed=1` shows `owed: ` before its text, and a row with `cleared=1` shows `note cleared` as its text. A `note` row carried from a hand-kept store shows `import` as who.
- `www show` with no id prints every open task in the brief's order, each row as the brief prints it and its note whole. It runs no check, so each tag shows the result saved by the last read.
- `www show <id>` prints the item's note whole, as `note (<age>):` or `owed note (<age>):`, wrapped as the brief wraps a note, with each further line indented 4.
- `www show <id>` for a lesson, a promise or the owner's words prints the row whole, with its journal days:

```text
$ www show l-seed
l-seed  lesson, open since day 6, by agent
  do this (2d): Reseed the staging alerts table before alerts-e2e
  why: A stale row made alerts-e2e pass on day 6 while no alert fired
  journal: day 6 lesson

$ www show due-cost
due-cost  promise, open since day 8, by agent · to owner · by day 10, before review
  what (19h): Cost table for the alert fan-out
  journal: day 8 promise

$ www show w-plain
w-plain  owner's words, open since day 3, by agent · said in chat
  words (6d): "Plain words in every reply; I would rather read three short sentences than one clever one"
  journal: day 3 words
```

- `www log --op lesson,promise,words` prints the rows of the three new kinds.
- `www show grant` prints where the owner gave the words and the scope, the bullets as the brief prints them, the reading whole, and the journal days of every `grant` row. With no grant, it prints `grant  none. Run: www grant --may "<what the owner allows, in their words>" --where <where> --reading "<what they cover; what the owner kept back>"`.

`www list`, `--json` on the read commands and `www goal --paste` are in [lists-and-json.md](lists-and-json.md).

### www recap

`www recap [--since <t>]` prints one screen for the owner: what the session holds, so the owner can check it against what they said and correct it with `www say`. `--since` takes the same values as `log`, and the default is `24h`. It runs no checks and never takes the lock. Once a session is found and its store is in format 2, a well-formed recap is never refused for what it finds in the store, except a `session` file that does not parse, as [Constraints](#constraints) says; a usage error, such as a `--since` it cannot read, exits 2. It runs from any shell, with no terminal test, because it writes nothing. The owner runs it from a terminal outside any agent, and an agent may run it too.

```text
$ www --session tide-alerts recap
tide-alerts · day 9 · recap since day 8 12:00Z (24h) · 24 writes
GRANT  from the owner in chat, 7d ago · in bosun-api, bosun-app and tidekit
  may    • merge the alert PRs once CI is green and every review finding is answered
         • deploy either app to staging whenever you need to
         • wipe or reseed the staging alerts table as often as you like
         • open PRs on tidal-org/tidekit from our fork
  not    • the prod database
  never  • the prod push certificate  • publishing a tidekit release
  reading: covers merges in both repos on green CI with findings answered, staging deploys, the
    staging alerts table, opening tidekit PRs; kept back: prod push cert, prod database, tidekit
    merges and releases
PROMISED (1, max 5)
  due-cost    Cost table for the alert fan-out · to owner · by day 10, before review
NOTES (3 on 13 open items) · owed first, then newest
  t-flag      Turn on the tide_alerts flag in staging config
    owed note (2d): Turn the tide_alerts flag back off in staging config before this closes: stagin…
  pr-api-77   Alert job retries a 503 3 times, 2 s apart; pushed 9b41c07
    note (1h): The 503s come from the feed's hourly refresh, about 4 s long (d-23). Retry 3 times, …
  wt-tz       bosun-api worktree for the time zone fix, branch tz-fix
    note (2d): Remove it with git worktree remove once the tz-fix PR merges; the simulator reads it…
  other open items (10): pr-tk-19, t-e2e, w-apns, w-tk, ok-prod-index, r-api-tests, r-tk-fork, r-si…
DECIDED SINCE day 8 12:00Z (2)
  d-23  Retry a 503 from the tide feed 3 times, 2 s apart · why: The feed returns 503 for about 4 s…
  d-24  ruled out: Queue failed alerts for the next tide · why: a queued alert lands after low water
CLOSED SINCE day 8 12:00Z (3)
  t-fixtures  done · bosunhq/bosun-api#75 merged as 0c41d2e
  w-design    done · the owner picked the 2-hour lead in chat, day 8
  pr-app-61   done · merged as 51aa0e2, seen by check
Whole text: www --session tide-alerts show <id>
Correct: www --session tide-alerts say "<text>" [--on <id>]
```

| Section   | Shows                                                                                         | Lines at most |
| --------- | --------------------------------------------------------------------------------------------- | ------------- |
| header    | `<name> · day <d> · recap since day <d> <HH:MMZ> (<t>) · <n> writes`                         | 1             |
| `GRANT`   | the grant, exactly as the brief prints it, or `GRANT  none. Run: www --session <name> show grant` | 23            |
| `PROMISED` | `PROMISED (<n>, max 5)`, then each promise, oldest first: `  <id>  <what> · to <who> · by <when>`, cut at 100 characters | 6 |
| `NOTES`   | `NOTES (<m> on <o> open items) · owed first, then newest`, `<m>` the open items with a note and `<o>` the open items; then the open items with a note, owed first, then newest by the note's time, ties in `notes.tsv` order: the item line, with an approval's quote in double quotes, then `    note (<age>): <note>` or `    owed note (<age>): <note>`; at most 6 items, then `  and <n> more with a note: www --session <name> log --op note`, then `  other open items (<n>): <ids>` for the open items with no note, in `items.tsv` order, cut at 100 characters | 15 |
| `DECIDED SINCE` | `decide` and `ruled-out` rows since `<t>`, oldest first: `  <d-n>  [ruled out: ]<choice> · why: <reason>`; the 5 oldest, then `  and <n> more: www --session <name> log --op decide,ruled-out --since <t>`, which prints every row since `<t>` | 7 |
| `CLOSED SINCE`  | `done`, `drop` and `use` rows since `<t>`, oldest first: `  <id>  <done, dropped or used> · <evidence, reason or use>`; the 5 oldest, then `  and <n> more: www --session <name> log --op done,drop,use --since <t>`, which prints every row since `<t>` | 7 |
| footer    | `Whole text: www [--session <name>] show <id>` and `Correct: www [--session <name>] say "<text>" [--on <id>]`, with `--session <name>` as the next paragraph says | 2             |

`NOTES` is left out when no item is open. With open items and no note, it prints `NOTES (0 on <o> open items) · owed first, then newest` and the `other open items` line. A section with no rows is left out, except `GRANT`, which prints `GRANT  none. Run: www --session <name> show grant` with no grant. The `writes` count is the journal rows since `<t>` with `by` `agent` or `owner`, except `changed` rows, which a read writes.

The recap reads from the start of the session when `<t>` falls before it, so the header and the two `SINCE` headings print `day 1` and the start's time, and the commands keep `<t>` as typed. When `journal.tsv` cannot be read, the header shows `journal unreadable` in place of `<n> writes`, `DECIDED SINCE` and `CLOSED SINCE` are left out, and stderr names the reason, as `show` does.

The owner runs the recap from a terminal that has no binding, so the no-grant line and the three overflow lines always carry `--session <name>`, with `<name>` the name of the session's folder, and each runs as printed. A recap run with `--session` prints it in both footer lines. A recap in a bound session, with no `--session`, prints neither, and the footer's two lines run there as printed.

The recap is at most 61 lines: 1 + 23 + (1 heading + 5 promises) + (1 heading + 6 × 2 + 1 overflow + 1 other-items line) + (1 heading + 5 + 1 overflow) + (1 heading + 5 + 1 overflow) + 2 = 61. Every line is at most 100 characters, except a `SINCE` overflow line when `<t>` is longer than 7 characters: the grant's heading is at most 94, its bullets and reading wrap at 100 as in the brief, the widest header (a 24-character name, day 999, `day-999`) is 87, the footer's two lines with a 24-character name are 60 and 72, and each other line that would pass 100 is cut to 99 characters and `…`, after a credential in a stored text becomes `<where the secret lives>`, so the cut counts the placeholder.

The grant's lines, the overflow lines and the footer's two lines are never cut, so each command runs as printed, and each overflow line stays within 100 for a `<t>` of at most 7 characters. A longer `<t>`, such as `0000024h`, adds each character past 7 to the two `SINCE` overflow lines, which stay whole so their commands run as typed. So the recap is at most 61 × 100 + 61 = 6,161 characters, plus 2 for each character of `<t>` past 7.

With counts of at most 4 digits where no cap applies, at most 62 open items in `items.tsv` and a header of 87 characters, the widest lines sum to at most 4,667 characters, or 4,680 when a header is cut at 100, under the bound of 6,161. In `NOTES`, `<m>` and `<o>` are at most 62, and with 6 items printed the overflow count is at most 56. Each has 2 digits, the heading is at most 53 characters, and the overflow line stays at 79 characters.

## Refusals

Each refusal exits 3 (exit 2, 4 and 5 where marked), prints its text on stderr, and ends with one or two `Run:` lines. When the tool can fix the call, the `Run:` line is the refused command with each bad value replaced and each missing flag added, so it is complete. When it cannot, such as with no session, a hand-kept store or a decision number it cannot guess, the `Run:` line is the command that gets the agent what the fix needs. A value only the agent knows is a `<placeholder>` for what goes there. Every other value comes from the agent's command or the store, such as the oldest open task when a kind is full. The examples use the invented session.

| When                                              | The text                                                                                                                                                                                               |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A claim, a next step or an approval quote is over its limit | `www: refused: the claim is 152 characters, and the limit is 120. Write what is true now, and put the detail in its note with --note.` `Run: www task t-e2e "<claim of at most 120 characters>"` |
| Any other text is over its limit, such as a decision | `www: refused: the decision is 201 characters, and the limit is 200. Write what is true now; the story belongs in a PR or a commit.` `Run: www decide "<decision of at most 200 characters>" --why "The feed flaps"` |
| A note is over its limit                          | `www: refused: the note is 512 characters, and the limit is 400. Keep what you need on your next turn to this item, and link the rest from a PR, an issue or a file.` `Run: www task t-e2e "Write alerts-e2e against staging" --note "<note of at most 400 characters>"` |
| A text holds a tab or a line break, a Unicode line or paragraph separator among them, except a line break in a grant bullet or the grant's scope, which `www grant` turns into a space | `www: refused: the text must be one line, with no tab or newline.` `Run: www rule r-sim-port "<one line>"`                                                                                             |
| A kind is full                                    | `www: refused: the session holds 30 of 30 tasks. Close one, or replace one with www set.` `Run: www done t-e2e --evidence "<PR, commit or test run>"`. The caps are 30 tasks, 8 waits, 15 rules and 8 where items, and the same text names each. A lesson: `www: refused: the session holds 5 of 5 lessons. Drop one, or replace one with www lesson.` `Run: www drop l-seed --why "<reason>"`. A promise: `www: refused: the session holds 5 of 5 promises. Close one, or replace one with www promise.` `Run: www done due-cost --evidence "<what you delivered>"`. The owner's words: `www: refused: the session holds 8 of 8 owner's words. Drop one, or replace one with www words.` `Run: www drop w-plain --why "<reason>"` |
| `ok` while the one-time approval is open          | `www: refused: the session holds 1 of 1 one-time approvals. Spend it with www use, or drop it.` `Run: www use ok-prod-index --for "<what you did with it>"`                                              |
| `ok --standing`                                   | `www: refused: lasting permission lives in the grant, in the owner's words whole.` `Run: www grant --may "<what the owner allows, in their words>" --where chat --reading "<what they cover; what the owner kept back>"` |
| `done`, `drop` or `use` on an item with an owed note | `www: refused: t-flag has an owed note (2d). Clear it once the work is done, or replace it with a note that is not owed.` then the note, indented 4, then `Run: www set t-flag --no-note` `Run: www set t-flag --note "<detail>"` |
| `--owed` with no `--note`                         | `www: refused: --owed marks a note, and this command gives none.` `Run: www task t-e2e "Write alerts-e2e against staging" --note "<what is owed>" --owed`                                                                                 |
| `set` with only an id                             | `www: refused: set needs a claim, --note or --no-note.` `Run: www set t-flag "<claim>"`                                                                                                                |
| `set` with a check and no claim                   | `www: refused: a check belongs to a claim, and set with no claim changes only the note.` `Run: www set pr-api-77 "<claim>" --pr bosunhq/bosun-api#77` |
| `--note` and `--no-note` together                 | `www: refused: --note replaces the note and --no-note clears it; give one.` `Run: www set t-flag --note "<the note as typed>"`                                                                                            |
| `--no-note` on an item with no note               | `www: refused: t-e2e has no note to clear.` `Run: www show t-e2e`                                                                                                                                      |
| A note write, `done`, `drop` or `use` while a `notes.tsv` row does not parse | `www: tide-alerts's notes.tsv line 3 does not parse: the id repeats an earlier row. Fix the row by hand.` `Run: less /home/sam/.local/state/wherewerewe/tide-alerts/notes.tsv` |
| `done` has no `--evidence`                        | `www: refused: done needs evidence a reader can open, such as a PR, a commit or a test run. For work you stopped, use drop.` `Run: www done pr-app-61 --evidence "<PR, commit or test run>"`           |
| `drop` has no `--why`                             | `www: refused: drop needs a reason.` `Run: www drop p-sim --why "<reason>"`                                                                                                                            |
| `ok` lacks a part                                 | `www: refused: an approval needs the owner's exact words, who gave them, where, and what they cover.` `Run: www ok ok-prod-index --quote "<their exact words>" --who owner --where chat --scope "<what it covers>"` |
| `grant` lacks a part                              | `www: refused: a grant needs at least one --may, --not or --never in the owner's words, where they were given, and your reading of what they cover and what the owner kept back.` `Run: www grant --not "replant the north beds before the soil report is in" --where chat --reading "<what they cover; what the owner kept back>"`; a command with no bullet flag gets a `--may "<what the owner allows, in their words>"` placeholder as well |
| The grant has more than 12 bullets                | `www: refused: the grant has 13 bullets, and the limit is 12. Put two parts that belong together in one bullet.` `Run:` the refused command with its bullets replaced by one placeholder for each group it typed, `--may "<what the owner allows, in their words>"`, `--not "<what the owner did not grant, in their words>"` and `--never "<what the owner ruled out, in their words>"`, and every other flag as typed |
| The grant takes more than 19 lines                | `www: refused: the grant takes 21 lines in the brief, and the limit is 19. Join short parts that belong together in one bullet, or put a long part in fewer words.` `Run:` the refused command with its bullets replaced as for more than 12 bullets |
| The grant's words are over 700 characters         | `www: refused: the grant's words are 812 characters in its bullets and scope, and the limit is 700.` `Run:` the refused command with its bullets replaced as for more than 12 bullets, such as `Run: www grant --may "<what the owner allows, in their words>" --never "<what the owner ruled out, in their words>" --scope "in bosun-api, bosun-app and tidekit" --where chat --reading "covers merges in both repos"` |
| The grant's scope is over 40 characters           | `www: refused: the grant's scope is 52 characters, and the limit is 40.` `Run:` the refused command with only the scope replaced by `"<grant's scope of at most 40 characters>"` |
| A grant bullet, scope, reading or `--where` holds `•` | `www: refused: the bullet cannot hold •, which the brief prints before each bullet.`, naming `the grant's scope`, `the reading` or `the where` for those. `Run:` the refused command with each `•` in that text replaced by `-`, such as `Run: www grant --may "deploy - migrate staging" --where chat --reading "covers staging"`. When that would leave a lone `-` or a text that looks like a credential, the text becomes `"<bullet>"`, `"<grant's scope>"`, `"<reading>"` or `"<where>"` |
| A flag that takes text is followed by a word that starts with a dash (exit 2) | `www: the value of --never starts with a dash, so it reads as a flag. Join the two with =, as in --never="<value>".` `Run:` the refused command with each such flag joined to its value, such as `Run: www grant --may "merge the alert PRs" --never="--force-push to main" --where chat --reading "covers merges"`. A word that names a flag of www, such as `--where`, stays a flag, and so does `--`. When the joined command would still fail, such as on a flag with no value, the refusal is the one for that failure, for example `www: --where needs a value.` `Run: www help` |
| `session` holds a value a write would refuse      | `www: tide-alerts's session does not parse: a grant bullet holds a tab or a line break. Fix the file by hand.` `Run: less /home/sam/.local/state/wherewerewe/tide-alerts/session` |
| The grant's reading is over 200 characters        | `www: refused: the reading is 231 characters, and the limit is 200.` `Run: www grant --reading "<reading of at most 200 characters>"`                                                                  |
| `grant --reading` with no grant                   | `www: refused: tide-alerts has no grant, so there is no reading to replace.` `Run: www grant --may "<what the owner allows, in their words>" --where <where> --reading "<the reading as typed>"`                   |
| `wait` has no `--who`                             | `www: refused: a wait names who it waits on.` `Run: www wait w-apns "upload the staging push key" --who "<who>"`                                                                                       |
| `decide` has no `--why`                           | `www: refused: a decision needs its reason.` `Run: www decide "Retry a 503 3 times" --why "<reason>"`                                                                                                  |
| `done` on a lesson or the owner's words           | `www: refused: l-seed is a lesson, and a lesson closes with drop.` `Run: www drop l-seed --why "<reason>"`, or `www: refused: w-plain holds the owner's words, and they close with drop.` `Run: www drop w-plain --why "<reason>"` |
| `lesson` has no `--why`                           | `www: refused: a lesson needs the mistake behind it.` `Run: www lesson l-seed "Reseed the staging alerts table before alerts-e2e" --why "<the mistake behind it>"` |
| `promise` lacks `--to` or `--by`                  | `www: refused: a promise names who gets it and when.` `Run: www promise due-cost "Cost table for the alert fan-out" --to <who> --by <when>` |
| `words` has no `--where`                          | `www: refused: the owner's words need where they were said.` `Run: www words w-plain "<the owner's exact words>" --where <where>` |
| `--to` or `--by` holds `;` or `=`                 | `www: refused: --by cannot hold ; or =, which the journal keeps apart.` `Run: www promise due-cost "Cost table for the alert fan-out" --to owner --by "<when, with no ; or =>"` |
| `list` with no kind or an unknown one (exit 2)    | `www: list takes tasks, waits, approvals, rules, where, lessons, promises, words, notes, decisions or prs.` `Run: www list tasks` |
| `goal --paste` beside a goal text (exit 2)        | `www: goal --paste takes no goal text.` `Run: www goal --paste` |
| `goal --paste` with no grant                      | `www: refused: tide-alerts has no grant to print.` `Run: www grant --may "<what the owner allows, in their words>" --where <where> --reading "<what they cover; what the owner kept back>"` |
| An id names no open item                          | `www: refused: no open item pr-api-78. Open items: pr-api-77, pr-tk-19, t-flag, t-e2e.` `Run: www task pr-api-78 "<claim>"`                                                                            |
| A new item reuses a closed id                     | `www: refused: pr-app-61 closed on day 9. Pick a new id.` `Run: www task <new id> "<claim>"`                                                                                                           |
| A new item, lesson, promise or words write reuses an open id of another kind, or `set`, `now`, `use` or `--blocked-by` names an id of a lesson, a promise or the owner's words | `www: refused: r-tk-fork is a rule. Change its text with set, or pick a new id.` `Run: www set r-tk-fork "<claim>"`; for a lesson, `www: refused: l-seed is a lesson. Change it with www lesson, or pick a new id.` `Run: www lesson l-seed "<do this>" --why "<the mistake behind it>"`; for a promise, `… is a promise. Change it with www promise, or pick a new id.` `Run: www promise due-cost "<what>" --to <who> --by <when>`; for the owner's words, `… holds the owner's words. Change them with www words, or pick a new id.` `Run: www words w-plain "<the owner's exact words>" --where <where>` |
| Two of the four files hold the same id open, as an earlier version of the tool can leave them | `www: refused: tide-alerts holds l-seed twice, as a task in items.tsv and as a lesson in lessons.tsv. Rename one of them by hand; the journal keeps both.` `Run: less <store path>/lessons.tsv`, for every write, close, `set` and `now` on that id; a read prints both rows and names the duplicate once on stderr |
| An id breaks the id rule                          | `www: refused: an id is 2 to 16 characters of a-z, 0-9 and -, starts with a letter, and is not grant, d-<n> or o-<n>.` `Run: www task t-tide-cache "<claim>"`                                         |
| A text looks like a credential                    | `www: refused: the text looks like a credential (it matches the ghp pattern). Write where the secret lives, never its value.` `Run: www where s-staging "<where the secret lives>"`                   |
| More than one check                               | `www: refused: an item takes one check. Split it into two items.` `Run: www task pr-api-77 "<claim>" --pr bosunhq/bosun-api#77`                                                                        |
| A check reference is malformed                    | `www: refused: --pr takes <owner>/<repo>#<number>, such as bosunhq/bosun-api#77.` `Run: www task pr-api-77 "<claim>" --pr <owner>/<repo>#<number>`                                                     |
| A path or branch check names a relative path      | `www: refused: --path takes an absolute path.` `Run: www where wt-tz "<claim>" --path /home/sam/src/bosun-api/.worktrees/tz-fix`                                                                       |
| A rule has a check                                | `www: refused: a rule has no check. Make the checked thing a where item.` `Run: www where <new id> "<claim>" --path /home/sam/src/bosun-api`                                                             |
| `--blocked-by` names no open task or wait          | `www: refused: --blocked-by w-apn names no open task or wait. Open: w-apns, w-tk, pr-api-77.` `Run: www task t-flag "<claim>" --blocked-by w-apns`                                                    |
| `--replaces` names no decision                    | `www: refused: there is no decision d-40; the last is d-25.` `Run: www log --op decide,ruled-out`                                                                                                      |
| `--replaces` names the owner's decision           | `www: refused: d-4 is the owner's decision, so only a decision recorded with --who owner replaces it.` `Run: www decide "<the owner's answer>" --why "<reason>" --who owner --replaces d-4`            |
| `say` or `ack` from an agent shell                | `www: refused: only the owner writes owner notes, from a terminal outside any agent. Record what the owner told you as a rule, a wait, an approval or the grant.` `Run: www rule <id> "<what the owner said, as a rule>"` |
| A third owner note                                | `www: refused: 2 owner notes already show. Clear one that is done.` `Run: www --session tide-alerts ack o-1`                                                                                           |
| `init` names a session that exists               | `www: refused: session tide-alerts exists. Bind this agent session to it.` `Run: www attach tide-alerts`                                                                                               |
| A session name breaks the name rule               | `www: refused: a session name is 2 to 24 characters of a-z, 0-9 and -, and starts with a letter.` `Run: www init tide-alerts --goal "<what done means>"`                                               |
| `attach` names no session                         | `www: refused: no session tide-alert. Sessions: tide-alerts, docs-move.` `Run: www attach tide-alerts`                                                                                                 |
| `attach` or `detach` with no agent session id     | `www: refused: this shell has no agent session id (no CLAUDE_CODE_SESSION_ID or CODEX_SESSION_ID). Name the session on each command.` `Run: www --session tide-alerts`                                 |
| The lock is held for 2 s                          | `www: refused: another write holds the lock on tide-alerts (pid 51022). Try again.` `Run: <the refused command, as typed>`                                                                             |
| No session (exit 4)                               | `www: no session for this agent. Sessions on this machine: tide-alerts (day 9), docs-move (day 2).` `Run: www attach <name>` `Run: www init <name> --goal "<what done means>"`                         |
| The store is hand-kept (exit 5)                   | `www: tide-alerts is a hand-kept store (format 0-by-hand). Convert it first.` `Run: www import tide-alerts`                                                                                           |
| The store is format 1 (exit 5)                    | `www: tide-alerts is format 1, and this www reads format 2. Upgrade it in place; the upgrade keeps a copy of each file it changes, and changes nothing when it refuses.` `Run: www import tide-alerts` |
| The store's format is newer (exit 5)              | `www: tide-alerts is format 3, and this www reads format 2.` `Run: bun add -g @wherewerewe/cli@latest`                                                                                             |
| `import` of a store already in format 2           | `www: refused: tide-alerts is already format 2. Bind this agent session to it.` `Run: www attach tide-alerts`                                                                                          |
| The upgrade finds standing approvals and no `--may` | `www: refused: tide-alerts holds 2 standing approvals, and format 2 keeps lasting permission in the grant. Record the owner's words in the same command.` then each approval as `  ok-merge  "merge the alert PRs yourself once CI is green" · bosun-api, bosun-app`, then `Run: www import tide-alerts --may "<what the owner allows, in their words>" --where chat --reading "<what they cover; what the owner kept back>"` |
| The upgrade finds more than one one-time approval | `www: refused: tide-alerts holds 2 one-time approvals, and format 2 holds 1. Drop all but one.` then each as `  ok-wipe  "you can wipe the staging alerts table once" · staging alerts table  [5d]`, then `Run: www import tide-alerts --drop ok-wipe` |
| The upgrade finds an item with the id `grant`     | `www: refused: format 2 keeps the id grant for the grant, and tide-alerts has an item grant. Drop it, and write it again under a new id after the upgrade.` `Run: www import tide-alerts --drop grant` |
| Import finds rows that break a rule               | `www: refused: import found 3 rows that break the rules, and wrote nothing.` then one line per row, such as `items.tsv line 9 (r-models): the claim is 151 characters, and the limit is 120.` and `journal.tsv: 9 open waits (q-1, q-2, q-3, q-4, q-5, q-6, q-7, q-8, q-9), and the limit is 8. Close one by appending the tab-separated row: <ts> closed <id> <what settled it>`, then `Run: www import build` |
| A `--since` that is not `24h`, `3d` or `day-7`, a value such as `-2h` that starts with a dash included, or one that names a time past the year 9999 (exit 2) | `www: --since takes 24h, 3d or day-7.` `Run: www log --since 24h` or `Run: www recap --since 24h`, the command that was typed |
| An unknown command (exit 2) | `www: unknown command "taks".` `Run: www help` |
| A flag the command does not take, a flag that no command takes among them (exit 2) | `www: wait takes no --on flag. It takes --pr, --branch, --path, --pid, --note, --owed and --who.` `Run: www wait <id> "<what>" --who <who> [<check>]`, the command's line in the help. The first line names the refused flag as typed and each flag the command takes, in the order of the table the parser reads, and leaves out a flag that the command always refuses with a text of its own, such as `--standing` on `ok`. A command that takes no flag of its own prints `www: sessions takes no --goal flag. It takes only --session.` and `Run: www sessions`; the brief's refusal names `the brief`, and its `Run:` line is `www`. A flag before an unknown command gets the unknown command's refusal |
| `show` with two ids (exit 2)                      | `www: show takes [<id>].` `Run: www help`                                                                                                         |
| `decide` with a `--who` other than `owner` or `agent` | `www: refused: --who on a decision is owner or agent.` `Run: www decide "Retry a 503 3 times" --why "The feed flaps" --who "<owner or agent>"` |

- When `www grant` or one upgrade finds more than one problem, it prints each problem's lines and one `Run:` line with every flag the problems need, so the filled line passes. `--drop` repeats once per id, such as `--drop ok-wipe --drop grant`.
- A standing approval is something the owner allowed, so the grant that folds it holds a `--may`.
- A grant bullet over 700 characters gets the words row, because a bullet has no limit of its own.
- The `Run:` line of a reading over its limit is the refused command with only the reading replaced, so `www grant --may … --reading …` and `www import … --reading …` keep their other flags.
- A claim, a next step and an approval quote, whose commands take `--note`, end an over-limit text with "Write what is true now, and put the detail in its note with --note." Every other text over its limit ends "Write what is true now; the story belongs in a PR or a commit." The note, the grant's words, the grant's lines, the grant's scope and the reading have their own rows.
- The credential test matches at least these: `ghp_`, `gho_`, `ghs_`, `ghu_`, `github_pat_`, `sk-` followed by 20 or more letters and digits, `xoxb-`, `xoxp-`, `AKIA` followed by 16 capitals or digits, `ops_` followed by 20 or more characters, `-----BEGIN`, and a JWT (`eyJ` then two `.`-separated parts). It applies to notes and to the grant's bullets, scope and reading, and to each grant bullet and each typed `--scope` with its line breaks and the spaces around them taken out, so a credential that a line break splits is refused too. A credential in one of those keeps the refused command and replaces only that value with `"<where the secret lives>"`. Two refusals replace it with their own placeholder first: a value over its own limit gets that limit's placeholder, and a grant over its bullets, words or lines gets one placeholder per group in place of every bullet.
- When a note is refused, the `Run:` line keeps the refused command and changes only the note. A note over its limit, with a tab or a newline, or that looks like a credential becomes `--note "<note of at most 400 characters>"`, `--note "<one line>"` or `--note "<where the secret lives>"`, and `--owed` with no `--note` gets `--note "<what is owed>"`. The `Run:` line then passes for a new item and for an item of any kind.
- When the agent typed `www` with `--session`, each `Run:` line keeps `--session <name>`. A `--session` value that starts with a dash, such as `--help`, leaves every `Run:` line, whether the agent typed it before the command or the `Run:` line repeats it, because the parser reads that value as a flag. A mistyped name stays, because dropping it would make the `Run:` line write to the session the shell is bound to.
- A `Run:` line is one output line. A line break in a `www` value prints as the space the store would keep, and a value that the credential test matches once its line breaks and the spaces around them are taken out prints as `<where the secret lives>`. A word of another command, such as a store path in `Run: less <path>`, that holds a tab or a line break prints in `$'…'` quotes, with each of those as octal escapes.
- A word after `--` in a `Run:` line is one positional. `www` never splits it or reads it as a flag, so `-- t-a '--may=x'` keeps `--may=x` as the claim.
- No output line holds text that the credential test matches. Each match, with the rest of its word, in a refusal's text, a `Run:` line, a key or an id read from the store, or an unknown command or flag, prints as `<where the secret lives>`. A flag whose value is replaced keeps its flag, as `--may "<where the secret lives>"`. A `Run:` word whose quotes would complete a match, such as `--may="-ops_…"` with 19 characters after `ops_`, prints as the placeholder too, so no quote is lost. A credential refusal names the pattern without its `_` or `-`, as `it matches the ghp pattern`, so the name is no match itself.
- The `Run:` line of a flag the command does not take is a usage line: the command's line in `www help`, as the help writes it, with its optional parts in brackets. Before it prints a usage line, `www` fills its placeholders with samples and puts it through its parser, once with the required words alone and once with each optional group, or each choice of a group that holds `|`, added; it prints the line unfilled. A choice such as `<tasks|waits>` fills as its first choice. A test fills each placeholder, leaves out each optional part, and runs the line.
- A placeholder is a word the refusal wrote for a value only the agent knows. A value the agent typed is never a placeholder, even one that reads like `<…>`, so the checks read it as text.
- Before it prints a `Run:` line, `www` fills each placeholder with a sample, except in a usage line; a usage line gets the parser check of the bullet before. The sample is a word that appears in no other word of the line, so `www` can tell it from a typed value, and it meets the placeholder's own rule: an id or a session name gets a valid id, a check flag a value of its form, and a decision's `--who` gets `owner` or `agent`. `www` then puts the filled line through its parser and through each check the command runs before it reads the store, by calling the functions the write calls: each text's checks for empty, one line, length and a credential, the item id, the session name, the check flags, the approval's parts, and for `grant` and `import` the grant's parts and texts. When the filled line would be refused, `www` prints that refusal and its own `Run:` line instead, and checks the new line the same way. After the third refusal in a row, the `Run:` line is `www help`. When the line's other words hold both `owner` and `agent`, no `--who` sample meets the sample rule, and the `Run:` line is `www help`. Checks that read the store run only when the agent runs the line: whether an id is open or closed, whether an id already holds another kind, a kind's cap, and whether a `set` gives a rule a check. Their rows in the table above are refusals the agent can still get from a printed `Run:` line.

## Constraints

- Once a session is found and its store is in format 2, a well-formed read is never refused for what it finds in the store or for a failed check: `www`, `show`, `log`, `list` and `recap` print what they can, even when every check fails. `www` and `show <id>` probe; `show` with no id, `log`, `list` and `recap` never do. A read with `--json` exits with the code its text form gives. A usage error, such as an unknown flag, still exits 2. A `session` file that does not parse is the one exception, because no read knows the session without it: each read refuses with the broken `session` text in [Refusals](#refusals). `sessions` needs no session and is never refused.
- A changed check never makes `set` refuse, so the agent can always fix a stale claim.
- A write changes only its command's files in [store.md](store.md); a refused write changes nothing, and a refused upgrade writes nothing, its backup included.
- Every refusal text and every `Run:` line is covered by a test that runs the refused command.
- Each printed `Run:` line other than a usage line, with its placeholders filled in, passes every check its command runs before it reads the store, from the same functions the write calls. So a printed `Run:` line is never refused for its own words, such as an empty, over-length or credential-like claim or a bad id: a line that would be is replaced before it prints, as [Refusals](#refusals) says.
- Never steer the agent, in a reply, a refusal or a help line, to hold back, to ask, or to act only inside a limit. The credential refusal's "never its value" is the one exception: it keeps a secret out of the store and the journal. [0008](../../decisions/0008-notes-the-grant-and-no-caution-steering.md)

## Decisions

- **`decide` takes no id; the tool numbers decisions.** The hand-kept log already numbers them d-1 upward, and a number the agent picks can clash.
- **A lesson, a promise and the owner's words are written by their own commands.** Each has a limit and a refusal of its own, and `done` closes only a promise. [0017](../../decisions/0017-a-lesson-is-a-kind-of-its-own.md), [0018](../../decisions/0018-a-promise-is-a-kind-of-its-own.md), [0019](../../decisions/0019-the-owners-words-are-a-kind-of-their-own.md)
- **`--blocked-by` stays.** The hand-kept store uses `blocked_by` on 3 of its 4 tasks, and the brief shows the blocker in the task's tag.
- **A ruled-out approach is its own journal op.** The Ruled out section of the [handoff skill](https://github.com/zgeoff/skills/blob/main/skills/handoff/SKILL.md) gets its rows from `www log --op ruled-out`.
- **A note is written only through `--note`, and `set` without a claim changes only the note.** One path means one place for the 400 limit, the credential test and the older-note line, and a note change never resets a claim's age or check. [0008](../../decisions/0008-notes-the-grant-and-no-caution-steering.md)
- **`www grant` sets the grant, and `ok --standing` is gone.** An approval is an item with a 120-character quote and a 40-character scope that counts against a cap; the grant is one per session, holds up to 12 bullets on 19 lines and 700 characters of the owner's words and a reading, and lives in `session`. One command per shape keeps each limit in one place. [0008](../../decisions/0008-notes-the-grant-and-no-caution-steering.md)
- **The owner corrects the reading with `www say`, and the agent rewrites it.** `say --on` takes an item id, so a plain `say` names the grant in its text; the agent then runs `www grant --reading`, and the owner clears the note with `ack`. [owner-notes.md](owner-notes.md)
- **Each bullet of the grant is its own flag.** `--may`, `--not` and `--never` repeat once per bullet, so the agent copies each part of what the owner said as it was said, and a refusal's `Run:` line names the one bullet to fix. [0008](../../decisions/0008-notes-the-grant-and-no-caution-steering.md)
- **The format 2 upgrade runs through `www import`.** The exit 5 text already names it for every store the tool cannot read, and one command covers both conversions.

## Builder decides

- The argument parser, and the spacing and column widths of `show`, `log`, `recap` and `sessions`.
- Fuzzy matching for the suggested id in a `Run:` line, such as `w-apns` for `w-apn`.
- The full credential pattern list, beyond the patterns above.
