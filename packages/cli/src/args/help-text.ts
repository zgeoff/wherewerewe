// The help block that commands.md fixes, character for character.
export const helpText = `www (wherewerewe): what is true now in one long agent session, in one short brief.

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
`;
