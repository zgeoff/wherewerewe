import { join } from 'node:path';
import { itemCaps, lessonCap, promiseCap, wordsCap } from '../rules/item-caps.ts';
import { textLimits } from '../rules/text-limits.ts';
import { formatLessonsFile } from '../store/format-lessons-file.ts';
import { formatNotesFile } from '../store/format-notes-file.ts';
import { formatPromisesFile } from '../store/format-promises-file.ts';
import { formatWordsFile } from '../store/format-words-file.ts';
import type { CLIResult } from '../types.ts';
import { buildMockIDs } from './build-mock-ids.ts';
import { buildSpacedText } from './build-spaced-text.ts';
import { seedItems } from './seed-items.ts';
import { seedStoreFile } from './seed-store-file.ts';
import { toThreeByte } from './to-three-byte.ts';

type RunAsAgent = (argv: readonly string[]) => Promise<CLIResult>;

interface WorstCaseShape {
  readonly taskCount: number;

  // the claim of each task, wait, approval, rule and where item
  readonly claim?: string;

  // every stored text but an id in a 3-byte script, as brief.md's 3-byte worst case has it
  readonly isThreeByte?: boolean;
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
  const text = (value: string): string => (shape.isThreeByte === true ? toThreeByte(value) : value);
  const claim = text(shape.claim ?? 'c'.repeat(120));
  const folder = join(stateRoot, name);
  const waits = buildMockIDs('wait', itemCaps.wait);
  const tasks = buildMockIDs('task', taskCount);
  const goal = text([...Array.from({ length: 21 }, () => 'goalword'), 'goalwordsss'].join(' '));
  const check = `pid:${String(process.pid)}`;

  await runAsAgent(['init', name, '--goal', goal]);

  await runAsAgent([
    'grant',
    ...Array.from({ length: 7 }, () => ['--may', text('m'.repeat(90))]).flat(),
    ...Array.from({ length: 5 }, () => ['--not', text('x'.repeat(6))]).flat(),
    '--scope',
    text('s'.repeat(40)),
    '--where',
    text('w'.repeat(16)),
    '--reading',
    text(buildSpacedText(200)),
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
      extra: { who: text('w'.repeat(16)) },
    })),
    {
      id: 'appr01',
      kind: 'ok' as const,
      claim,
      extra: { who: text('owner'), scope: text('s'.repeat(40)) },
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

  await runAsAgent(['now', tasks[0] ?? '', text('n'.repeat(120))]);

  for (const number of [1, 2, 3]) {
    await runAsAgent(['decide', text(`Choice ${String(number)}`), '--why', text('A reason')]);
  }

  seedStoreFile(
    folder,
    'lessons.tsv',
    formatLessonsFile(
      buildMockIDs('less', lessonCap).map((id) => ({
        id,
        text: text('c'.repeat(120)),
        why: text('w'.repeat(200)),
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
        what: text('c'.repeat(120)),
        to: text('t'.repeat(16)),
        byWhen: text('b'.repeat(24)),
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
        words: text('c'.repeat(300)),
        where: text('w'.repeat(textLimits.wordsWhere)),
        written: '2026-03-10T09:00:00Z',
        by: 'owner' as const,
      })),
    ),
  );

  const noteWords = [...Array.from({ length: 4 }, () => 'n'.repeat(81)), 'n'.repeat(72)];

  const note = {
    id: tasks[0] ?? '',
    owed: true,
    written: '2026-03-10T09:00:00Z',
    note: text(noteWords.join(' ')),
  };

  seedStoreFile(folder, 'notes.tsv', formatNotesFile([note]));
}
