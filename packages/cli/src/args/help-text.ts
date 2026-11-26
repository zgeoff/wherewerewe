export const helpText = `www: notes for one long agent session, one labelled row at a time.

Read
  www                         the brief: every open row, grouped by label
  www rows [--all]            every open row as JSON lines, for jq and grep; --all adds closed
                              rows and old versions

Write
  www <label> "<text>" [--note "<detail>"] [--id <id>]
                              a row with any label you choose: task, rule, where, lesson, ...
  www goal "<text>"           what done means            (one row; a new one replaces it)
  www pin "<text>"            the one thing to steer by  (one row)
  www now "<text>"            your next step             (one row)
  www grant "<text>"          what the owner allowed or kept back, as you understand it
  www wait "<text>" --who <who>
  www decide "<text>" --why "<reason>"
  www pr <number or URL> [--note "<detail>"]
  www set <id> ["<text>"] [--note "<detail>"]
  www done <id> [--evidence "<PR, commit or test run>"]
  www drop <id> [--why "<reason>"]

Sessions
  www init <name> --goal "<what done means>"
  www attach <name> [--switch]    --switch moves a shell that is bound to another session
  www detach
  www sessions

Setup
  www install [--print]       hooks, allow rules and the www skill for Claude Code and Codex
  www doctor                  checks that setup

Keep a text to 300 characters and a note to 1,500. Every command but bare www prints JSON;
add --human for plain text. In a shell with no session, add --session <name>.
`;
