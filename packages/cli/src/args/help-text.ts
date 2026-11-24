// The help block that commands.md fixes, character for character.
export const helpText = `www (wherewerewe): what is true now in one long agent session, in one short brief.

Read. Run www first, after every compaction, and whenever you are unsure:
  www                        the brief: goal, grant, owner notes, what changed, now and its note,
                             open work, waits, the approval, rules, where things are. Runs checks.
  www show [<id>]            one item, decision or the grant (www show grant): its text, its note,
                             its check now, its journal rows. With no id, every open task in full
  www log [--since <t>] [--op <op,...>] [--id <id>]
                             the journal, oldest first. <t> is 24h, 3d or day-7
  www sessions               every session on this machine
  www recap [--since <t>]    one screen for the owner: the grant, notes, decisions, what closed

Write as you go. One id holds one claim and one note; --note replaces the note:
  www now <id> "<next step>" [--note "<detail>" [--owed]]
  www task <id> "<claim>" [<check>] [--blocked-by <id>] [--note "<detail>" [--owed]]
  www wait <id> "<what>" --who <who> [<check>]
  www ok <id> --quote "<their exact words>" --who <who> --where <where> --scope "<scope>"
  www rule <id> "<do it this way, and why>"
  www where <id> "<what and where, and how to stop it>" [<check>]
  www set <id> ["<claim>"] [<check>] [--note "<detail>" [--owed] | --no-note]
  www decide "<choice>" --why "<reason>" [--on <id>] [--who owner] [--ruled-out] [--replaces d-<n>]
  www goal "<what done means>"
  www grant [--may "<words>"] [--not "<words>"] [--never "<words>"] [--scope "<scope>"]
            --where <where> --reading "<what they cover; what the owner kept back>"
  www grant --reading "<what they cover; what the owner kept back>"

Notes: --note "<detail>" and --owed work on now and on every item write. A note holds what you
need on your next turn to that item. An owed note stops done, drop and use until set clears it.
Grant: --may, --not and --never repeat, one bullet each, in the owner's words; a grant needs one.

Close. Each leaves the brief and stays in the journal:
  www done <id> --evidence "<PR, commit or test run>"
  www drop <id> --why "<reason>"
  www use <id> --for "<what you did with it>"     spend the one-time approval

Checks, one per item: --pr <owner>/<repo>#<n>  --branch <repo path>@<branch>  --path <path>  --pid <n>

Owner, from a terminal outside any agent:  www say "<text>" [--on <id>]   www ack o-<n>

Session: www init <name> --goal "<goal>"   www attach <name>   www detach   www import <name>
Setup:   www install [--print]   www doctor
Any command takes --session <name>.

Limits: a claim is one line of at most 120 characters, a note 400, the grant's words 700 in at most
12 bullets on at most 19 lines of the brief, and its reading 200. A session holds at most 30 tasks,
4 waits, 1 approval, 5 rules, 4 where items and 2 owner notes.
Exit codes: 0 done, 2 usage, 3 refused, 4 no session, 5 store needs import or upgrade.
`;
