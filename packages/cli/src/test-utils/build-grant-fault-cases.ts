export interface GrantFaultCase {
  // the faults it holds, joined by commas
  readonly title: string;
  readonly argv: readonly string[];
}

interface GrantCommand {
  readonly positionals: readonly string[];
  readonly bullets: readonly (readonly [string, string])[];
  readonly reading: string;
  readonly where: string | null;
}

// `www grant` commands with each fault alone, each pair of faults, and all of them at once.
export function buildGrantFaultCases(): GrantFaultCase[] {
  const faults = buildFaults();

  const pairs = faults.flatMap((first, at) =>
    faults.slice(at + 1).map((second) => [first, second]),
  );

  return [...faults.map((fault) => [fault]), ...pairs, faults].map((combination) => ({
    title: combination.map(([name]) => name).join(', '),
    argv: buildArgv(
      combination.reduce<GrantCommand>((current, [, addFault]) => addFault(current), {
        positionals: [],
        bullets: [],
        reading: 'covers watering',
        where: 'chat',
      }),
    ),
  }));
}

type Fault = readonly [string, (command: GrantCommand) => GrantCommand];

// A credential that the credential test matches, built from parts so no commit holds one.
export const faultCredential = ['ghp', '_', 'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8'].join('');

function buildFaults(): Fault[] {
  return [
    ['a dash value', addBullets(['never', '-keep the gate'])],
    ['an extra positional', (command) => ({ ...command, positionals: ['extra'] })],
    ['an empty reading', (command) => ({ ...command, reading: '-' })],
    ['a --where with no value', (command) => ({ ...command, where: null })],
    [
      'words over 700 characters',
      addBullets(...Array.from({ length: 6 }, (): [string, string] => ['not', 'n'.repeat(120)])),
    ],
    ['a line break', addBullets(['may', 'water\nthe beds'])],
    ['a bullet mark', addBullets(['not', 'dig • spray'])],
    ['a credential', addBullets(['not', `token ${faultCredential}`])],
  ];
}

function addBullets(...bullets: (readonly [string, string])[]) {
  return (command: GrantCommand): GrantCommand => ({
    ...command,
    bullets: [...command.bullets, ...bullets],
  });
}

function buildArgv(command: GrantCommand): string[] {
  return [
    'grant',
    ...command.positionals,
    '--may',
    'water',
    ...command.bullets.flatMap(([flag, value]) => [`--${flag}`, value]),
    '--reading',
    command.reading,
    ...(command.where === null ? ['--where'] : ['--where', command.where]),
  ];
}
