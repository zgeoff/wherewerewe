import { dirname } from 'node:path';
import { briefFooter } from '../brief/join-brief.ts';
import { gateTexts } from '../hooks/gate-texts.ts';
import type { Harness } from '../hooks/types.ts';
import type { runCLI } from '../run-cli.ts';

interface BriefRun {
  readonly harness: Harness;
  readonly root: string;
  readonly now: number;
  readonly runCLI: typeof runCLI;
}

// The injection the design gives a SessionStart of that store: its GOAL and GRANT lines, then the
// two lines of the standard reason. A brief that is not the design's whole goes into problems.
export async function readExpectedInjection(
  run: BriefRun,
  name: string,
  problems: string[],
): Promise<string> {
  const brief = await run.runCLI({
    argv: ['--session', name],
    env: { XDG_STATE_HOME: dirname(run.root) },
    cwd: dirname(run.root),
    now: () => run.now,
    terminal: { stdin: false, stdout: false },
  });

  const expected = formatSeededBrief(name);

  if (brief.exitCode !== 0 || brief.stderr !== '' || brief.stdout !== expected) {
    problems.push(`the brief of ${name} printed ${JSON.stringify(brief)}`);
  }

  const blocks = expected.split('\n').slice(1, 3);

  return `${[...blocks, ...gateTexts.standardReason(name, run.harness).split('\n')].join('\n')}\n`;
}

// The brief brief.md gives a store that seedHookStore made, read on its ninth day: the header, the
// goal, the empty GRANT and NOW lines, and the footer.
function formatSeededBrief(name: string): string {
  return [
    `${name} · day 9 · Tue 2026-03-10 11:43Z · last write never · no checks`,
    'GOAL  Ship the parser with its tests',
    'GRANT  none. Run: www grant --may "<what the owner allows, in their words>" --where <where> --reading "<what they cover; what the owner kept back>"',
    'NOW  none. Run: www now <id> "<next step>"',
    briefFooter,
    '',
  ].join('\n');
}
