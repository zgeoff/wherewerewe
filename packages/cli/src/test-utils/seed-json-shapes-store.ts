import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { linkCommands } from '@zgeoff/testing/bin';
import { runCLI } from '../run-cli.ts';
import { formatPrsFile } from '../store/format-prs-file.ts';
import { seedDayNineStore } from './seed-day-nine-store.ts';
import { seedStoreFile } from './seed-store-file.ts';
import { seedWorstCaseStore } from './seed-worst-case-store.ts';

// The store of a --json test, and the env of the agent that reads it: the day 9 session of
// brief.md, or the 3-byte worst case, whose text brief is cut, with 12 open pull requests.
export async function seedJsonShapesStore(
  root: string,
  store: 'day 9' | 'worst case',
): Promise<Record<string, string>> {
  if (store === 'day 9') {
    const day = await seedDayNineStore(root);

    return { ...day.env, CLAUDE_CODE_SESSION_ID: '', WHEREWEREWE_SESSION: 'tide-alerts' };
  }

  const bin = join(root, 'bin');
  const stateRoot = join(root, 'wherewerewe');
  const name = 'n'.repeat(24);

  mkdirSync(bin, { recursive: true });
  linkCommands(bin, ['git']);

  const env = { HOME: root, XDG_STATE_HOME: root, CLAUDE_CODE_SESSION_ID: 'a1b2-test', PATH: bin };

  const run = (argv: readonly string[]) =>
    runCLI({
      argv,
      env,
      cwd: '/work',
      terminal: { stdin: false, stdout: false },
      now: () => Date.parse('2026-03-10T11:43:00Z'),
    });

  await seedWorstCaseStore(run, stateRoot, name, { taskCount: 30, isThreeByte: true });

  seedStoreFile(
    join(stateRoot, name),
    'prs.tsv',
    formatPrsFile(
      Array.from({ length: 12 }, (_value, index) => ({
        ref: `bosunhq/bosun-api#${String(100 + index)}`,
        opened: '2026-03-10T08:43:00Z',
        state: 'OPEN' as const,
        seen: '2026-03-10T09:00:00Z',
      })),
    ),
  );

  await run(['attach', name]);

  return env;
}
