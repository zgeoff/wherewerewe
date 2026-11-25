import { skillMark } from './skill-mark.ts';

// The www skill that install writes: a way of working, with the commands it needs.
export function renderSkill(version: string): string {
  return `---
name: www
description: "Keeps what is true in a long agent session as short labelled rows that survive a compaction. Load it at the start of a long or autonomous session, after a compaction, and before stopping work another session will pick up."
metadata:
  ${skillMark} ${version}
---

# www

Your context gets compacted, and you forget. \`www\` holds what you would not want to forget, as short rows, and prints them back as one brief.

## The loop

1. Run bare \`www\` at the start of work and after every compaction. A hook holds your other calls after a compaction until you have.
2. When something becomes true that you would need after forgetting, write a row.
3. When a row stops being true, close it: \`www done <id> --evidence "<PR, commit or test run>"\`, or \`www drop <id>\`.
4. Before you stop, read \`www\` once as the next agent would, and fix what would mislead them.

Start a session with \`www init <name> --goal "<what done means>"\`. Pick one up with \`www attach <name>\`.

## A good row

One fact, in one line: \`www <label> "<text>"\`. Add \`--note "<detail>"\` for what the line cannot hold.

- The label is your word for what the row is: \`task\`, \`rule\`, \`where\`, \`lesson\`. Invent the ones your work needs.
- \`www goal\`, \`www pin\` and \`www now\` each hold one row: what done means, the one thing to steer by, and your next step. Keep \`now\` current.
- \`www grant "<their words>"\`: what your owner allowed or kept back, as they said it. Read it before you ask them for something.
- \`www wait "<what>" --who <who>\`: what you wait on, and from whom.
- \`www decide "<choice>" --why "<reason>"\`: a choice you would otherwise reopen.
- \`www pr <number or URL>\`: a pull request you opened.
- When a row waits on another, say so in its text: "blocked by wait-2".
- Write what happened as a \`note\` row or as evidence on a close. Keep open rows for what is still true or still to do.

A text holds 300 characters. When yours is longer, it is two rows, or a row and a note.

## Find things again

\`www rows\` prints every open row as JSON lines, and \`--all\` adds the closed ones.

\`\`\`sh
www rows | jq -r 'select(.label=="decision") | "\\(.id)  \\(.text)"'
www rows | grep -i token
www rows --all | jq -r 'select(.closed) | "\\(.id)  \\(.closed.evidence // "")"'
\`\`\`

Every command but bare \`www\` prints JSON; add \`--human\` for plain text. In a subagent's shell or a plain terminal, add \`--session <name>\`.
`;
}
