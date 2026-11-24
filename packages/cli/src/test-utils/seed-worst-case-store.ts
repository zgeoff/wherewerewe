import { join } from 'node:path';
import { formatNotesFile } from '../store/format-notes-file.ts';
import type { CLIResult } from '../types.ts';
import { buildMockIDs } from './build-mock-ids.ts';
import { buildSpacedText } from './build-spaced-text.ts';
import { seedItem } from './seed-item.ts';
import { seedStoreFile } from './seed-store-file.ts';

type RunAsAgent = (argv: readonly string[]) => Promise<CLIResult>;

// A session at brief.md's worst case, made through the commands and the store module: the grant,
// a goal of 200 characters, every other kind at its cap, the tasks asked for, and an owed note on
// the task in focus. `runAsAgent` runs a command as the agent that the session binds to.
export async function seedWorstCaseStore(
  runAsAgent: RunAsAgent,
  stateRoot: string,
  name: string,
  taskCount: number,
): Promise<void> {
  const folder = join(stateRoot, name);
  const waits = buildMockIDs('wait', 4);
  const tasks = buildMockIDs('task', taskCount);
  const goal = [...Array.from({ length: 21 }, () => 'goalword'), 'goalwordsss'].join(' ');
  const check = `pid:${String(process.pid)}`;

  await runAsAgent(['init', name, '--goal', goal]);

  await runAsAgent([
    'grant',
    ...Array.from({ length: 7 }, () => ['--may', 'm'.repeat(90)]).flat(),
    ...Array.from({ length: 5 }, () => ['--not', 'x'.repeat(6)]).flat(),
    '--scope',
    's'.repeat(40),
    '--where',
    'w'.repeat(16),
    '--reading',
    buildSpacedText(200),
  ]);

  for (const id of tasks) {
    await seedItem(folder, {
      id,
      claim: 'c'.repeat(120),
      check,
      atWrite: 'alive',
      last: 'alive',
      extra: { blocked_by: waits[0] ?? '' },
    });
  }

  for (const id of waits) {
    await seedItem(folder, {
      id,
      kind: 'wait',
      claim: 'c'.repeat(120),
      check,
      atWrite: 'alive',
      last: 'alive',
      extra: { who: 'w'.repeat(16) },
    });
  }

  await seedItem(folder, {
    id: 'appr01',
    kind: 'ok',
    claim: 'q'.repeat(120),
    extra: { who: 'owner', scope: 's'.repeat(40) },
  });

  for (const id of buildMockIDs('rule', 5)) {
    await seedItem(folder, { id, kind: 'rule', claim: 'c'.repeat(120) });
  }

  for (const id of buildMockIDs('here', 4)) {
    await seedItem(folder, {
      id,
      kind: 'where',
      claim: 'c'.repeat(120),
      check,
      atWrite: 'alive',
      last: 'alive',
    });
  }

  await runAsAgent(['now', tasks[0] ?? '', 'n'.repeat(120)]);

  seedStoreFile(
    folder,
    'notes.tsv',
    formatNotesFile([
      {
        id: tasks[0] ?? '',
        owed: true,
        written: '2026-03-10T09:00:00Z',
        note: [...Array.from({ length: 4 }, () => 'n'.repeat(81)), 'n'.repeat(72)].join(' '),
      },
    ]),
  );
}
