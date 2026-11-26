import { skillMark } from './skill-mark.ts';

// The www skill that install writes.
export function renderSkill(version: string): string {
  return `---
name: www
description: "Keeps what is true in a long agent session as short labelled rows that survive a compaction. Load it at the start of a long or autonomous session, after a compaction, and before stopping work another session will pick up."
metadata:
  ${skillMark} ${version}
---

# www

Keep what you must not forget in \`www\`, as short rows. A compaction drops most of your context, and bare \`www\` prints your rows back as one brief. You hand nothing back. You're done when every open row is true and the brief fits one screen.

## Key rules

- [Read and write](#read-and-write): read the brief after every compaction, and write a row when a fact becomes true.
- [Write a row](#write-a-row): one fact in one line, under a label you pick.
- [Write what your owner meant](#write-what-your-owner-meant): plain words you can act on, read back once.
- [Keep the brief to one screen](#keep-the-brief-to-one-screen): close the rows of finished work.
- [Find a row](#find-a-row): \`www rows\`, with \`jq\` or \`grep\`.

## Read and write

1. Run bare \`www\` when you start work and after every compaction. After a compaction, the \`www\` hook refuses your other tool calls until you do.
2. Write a row when a fact becomes true that you will need after the next compaction.
3. Close a row when it stops being true: \`www done <id> --evidence "<PR, commit or test run>"\`, or \`www drop <id>\`.
4. Before you stop, read \`www\` as an agent with none of your context, and fix each row that would mislead that agent.

When you have no session yet, start one with \`www init <name> --goal "<what done means>"\`. Join a session that exists with \`www attach <name>\`.

## Write a row

Write one fact in one line, with \`www <label> "<text>"\`. Add \`--note "<detail>"\` for the detail that does not fit in the line.

Pick a label that says what the row is, such as \`task\`, \`rule\`, \`where\` or \`lesson\`, and invent the labels your work needs. Use these labels as the table says:

| Command | What you write |
| --- | --- |
| \`www goal "<text>"\` | What done means. A new goal replaces the old one. |
| \`www pin "<text>"\` | The one thing to steer by. A new pin replaces the old one. |
| \`www now "<text>"\` | Your next step. Write it again each time the step changes. |
| \`www grant "<text>"\` | What your owner allowed or kept back. Read the grants before you ask your owner for something. |
| \`www wait "<text>" --who <who>\` | What you wait on, and who you wait on. |
| \`www decide "<text>" --why "<reason>"\` | A choice you would otherwise reopen. \`www\` labels the row \`decision\`. |
| \`www pr <number or URL>\` | A pull request you opened. |

- Keep a text to 300 characters and a note to 1,500. \`www\` refuses a longer one. Split a long text into two rows, or into a row and a note.
- When a row waits on another row, say so in its text, such as "blocked by wait-2".
- Keep a row open only while it is still true or still to do. Record what happened in a \`note\` row, or in \`--evidence\` when you close a row.

## Write what your owner meant

Write your owner's instruction as what they meant, in plain words you can act on. The next reader has none of the conversation, and has to guess what a quote means.

- Turn a chat line such as "yeah merge your own PRs here, you don't need me" into \`www grant "I merge my own PRs in this repo without asking"\`.
- When a row gives you authority, read it back to your owner once. Correct it with \`www set <id> "<text>"\`.
- Quote your owner only when the exact wording matters, such as a name they chose.

## Keep the brief to one screen

Keep the brief short enough to read whole after a compaction. You skim a longer brief, and miss rows.

- When a piece of work ends, close the rows that were only about it: \`www done <id>\` for what you finished, and \`www drop <id>\` for what no longer matters. Keep each grant and rule that still applies.
- Drop a decision once the code, a doc or a merged PR records it.
- Start a note with the part you will need. The brief prints the first line of a note, up to 160 characters, and \`www rows\` prints all of it.
- When the brief is longer than one screen, close rows before you write more.

## Find a row

\`www rows\` prints each open row as one JSON line. Add \`--all\` for the closed rows and the old versions of each row.

\`\`\`sh
www rows | jq -r 'select(.label=="decision") | "\\(.id)  \\(.text)"'
www rows | grep -i token
www rows --all | jq -r 'select(.closed) | "\\(.id)  \\(.closed.evidence // "")"'
\`\`\`

Every command except bare \`www\` and \`www help\` prints JSON. Add \`--human\` for plain text. When \`www\` refuses a command, read the reason and the command to run in its reply. In a subagent's shell or a plain terminal, add \`--session <name>\` to each command.
`;
}
