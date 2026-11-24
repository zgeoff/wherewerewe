import { join } from 'node:path';
import { itemCaps, lessonCap, promiseCap, wordsCap } from '../rules/item-caps.ts';
import { formatLessonsFile } from '../store/format-lessons-file.ts';
import { formatNotesFile } from '../store/format-notes-file.ts';
import { formatPromisesFile } from '../store/format-promises-file.ts';
import { formatWordsFile } from '../store/format-words-file.ts';
import type { CLIResult } from '../types.ts';
import { buildMockIDs } from './build-mock-ids.ts';
import { buildSpacedText } from './build-spaced-text.ts';
import { seedItems } from './seed-items.ts';
import { seedStoreFile } from './seed-store-file.ts';

type RunAsAgent = (argv: readonly string[]) => Promise<CLIResult>;

interface WorstCaseShape {
  readonly taskCount: number;

  // the claim of each task, wait, approval, rule and where item
  readonly claim?: string;
}

// A session at brief.md's worst case, made through the commands and the store module: the grant,
// a goal of 200 characters, every other kind at its cap, 3 decisions and an owed note on the task
// in focus. `runAsAgent` runs a command as the agent that the session binds to.
export async function seedWorstCaseStore(
  runAsAgent: RunAsAgent,
  stateRoot: string,
  name: string,
  shape: WorstCaseShape,
): Promise<void> {
  const taskCount = shape.taskCount;
  const claim = shape.claim ?? 'c'.repeat(120);
  const folder = join(stateRoot, name);
  const waits = buildMockIDs('wait', itemCaps.wait);
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

  await seedItems(folder, [
    ...tasks.map((id) => ({
      id,
      claim,
      check,
      atWrite: 'alive',
      last: 'alive',
      extra: { blocked_by: waits[0] ?? '' },
    })),
    ...waits.map((id) => ({
      id,
      kind: 'wait' as const,
      claim,
      check,
      atWrite: 'alive',
      last: 'alive',
      extra: { who: 'w'.repeat(16) },
    })),
    {
      id: 'appr01',
      kind: 'ok' as const,
      claim,
      extra: { who: 'owner', scope: 's'.repeat(40) },
    },
    ...buildMockIDs('rule', itemCaps.rule).map((id) => ({
      id,
      kind: 'rule' as const,
      claim,
    })),
    ...buildMockIDs('here', itemCaps.where).map((id) => ({
      id,
      kind: 'where' as const,
      claim,
      check,
      atWrite: 'alive',
      last: 'alive',
    })),
  ]);

  await runAsAgent(['now', tasks[0] ?? '', 'n'.repeat(120)]);

  for (const number of [1, 2, 3]) {
    await runAsAgent(['decide', `Choice ${String(number)}`, '--why', 'A reason']);
  }

  seedStoreFile(
    folder,
    'lessons.tsv',
    formatLessonsFile(
      buildMockIDs('less', lessonCap).map((id) => ({
        id,
        text: 'c'.repeat(120),
        why: 'w'.repeat(200),
        written: '2026-03-10T09:00:00Z',
        by: 'agent' as const,
      })),
    ),
  );

  seedStoreFile(
    folder,
    'promises.tsv',
    formatPromisesFile(
      buildMockIDs('prom', promiseCap).map((id) => ({
        id,
        what: 'c'.repeat(120),
        to: 't'.repeat(16),
        byWhen: 'b'.repeat(24),
        written: '2026-03-10T09:00:00Z',
        by: 'agent' as const,
      })),
    ),
  );

  seedStoreFile(
    folder,
    'words.tsv',
    formatWordsFile(
      buildMockIDs('word', wordsCap).map((id) => ({
        id,
        words: 'c'.repeat(300),
        where: 'w'.repeat(16),
        written: '2026-03-10T09:00:00Z',
        by: 'owner' as const,
      })),
    ),
  );

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
