import { buildTerminalWWWArgv } from './build-terminal-www-argv.ts';

interface OwnerProgram {
  readonly argv: readonly string[];
  readonly set: Readonly<Record<string, string>>;
}

const programs: Readonly<Record<string, OwnerProgram>> = {
  'say-as-agent': { argv: ['say', 'A note from an agent shell'], set: { CODEX_CI: '1' } },
  'say-first': {
    argv: ['say', 'Ask me before you change the kiln simulator port.'],
    set: {},
  },
  'say-second': {
    argv: ['say', 'Use the recorded kiln readings in the timer tests', '--on', 't-timer'],
    set: {},
  },
  'say-third': { argv: ['say', 'Ship the timer before the Friday firing'], set: {} },
  'ack-first': { argv: ['ack', 'o-1'], set: {} },
};

// The programs of the terminal driver for the owner-notes journey: each runs the real www in the
// run's session trial-owner, as an owner terminal, except the one that plays an agent.
export function buildOwnerPrograms(stateRoot: string): Record<string, { command: string[] }> {
  return Object.fromEntries(
    Object.entries(programs).map(([name, program]) => [
      name,
      {
        command: [
          ...buildTerminalWWWArgv(
            stateRoot,
            ['--session', 'trial-owner', ...program.argv],
            program.set,
          ),
        ],
      },
    ]),
  );
}
