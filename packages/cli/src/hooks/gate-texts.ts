import type { Harness } from './types.ts';

const codexRun = 'Run: www   (pass max_output_tokens 10000, so the whole brief reaches you)';

// Every text a hook puts in front of the agent, as a function of the session name.
export const gateTexts = {
  // the two lines the injection ends with, and the reason of a refusal and of a Stop block
  standardReason: (name: string, harness: Harness): string =>
    `wherewerewe: this session started or was compacted, and ${name}'s brief is not in your context yet.\n${harness === 'codex' ? codexRun : 'Run: www'}`,
  cutReason: (name: string): string =>
    `wherewerewe: www's output reached you cut, so ${name}'s brief is not whole in your context.\n${codexRun}`,
  failOpenLine: (name: string): string =>
    `wherewerewe: www printed no whole brief for ${name}, so this session's tool calls go through until the next resume or compaction.`,
  subagentLine: (name: string): string =>
    `This session keeps its notes in wherewerewe session ${name}. When a www command says there is no session, add --session ${name}.`,
  nudge: (name: string, age: string): string =>
    `wherewerewe: you pushed or merged, and the last write to ${name} was ${age} ago. Record it: www set <id> "<claim>" or www done <id> --evidence "<PR or commit>"`,
};
