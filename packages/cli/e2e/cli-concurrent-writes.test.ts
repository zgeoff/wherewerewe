import { expect, test } from 'bun:test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { resolveProgram } from '@zgeoff/rig/e2e';
import { createTempDir } from '@zgeoff/testing/fs';
import { run } from '@zgeoff/testing/process';
import { parseItemsFile } from '../src/store/parse-items-file.ts';
import { parseJournalFile } from '../src/store/parse-journal-file.ts';
import { parseSessionFile } from '../src/store/parse-session-file.ts';

async function setupTest() {
  const program = await resolveProgram('www');

  const stateHome = createTempDir('concurrent-writes').path;

  const env = {
    XDG_STATE_HOME: stateHome,
    CLAUDE_CODE_SESSION_ID: '',
    CODEX_SESSION_ID: '',
    CODEX_THREAD_ID: '',
    WHEREWEREWE_SESSION: '',
  };

  return {
    folder: join(stateHome, 'wherewerewe', 'race-notes'),
    runWWW: (args: readonly string[]) =>
      run(program.command, { cwd: program.cwd, env, args: [...args, '--session', 'race-notes'] }),
    runInit: () =>
      run(program.command, {
        cwd: program.cwd,
        env,
        args: ['init', 'race-notes', '--goal', 'Ten writes at once'],
      }),
  };
}

test('it lands ten writes started at once, with no partial row and no file left over', async () => {
  const ctx = await setupTest();

  await ctx.runInit();

  const results = await Promise.all([
    ...['a', 'b', 'c', 'd', 'e', 'f'].map((letter) =>
      ctx.runWWW(['task', `t-${letter}`, `Claim ${letter}`]),
    ),
    ...['a', 'b', 'c', 'd'].map((letter) =>
      ctx.runWWW(['wait', `w-${letter}`, `Answer ${letter}`, '--who', 'owner']),
    ),
  ]);

  const items = parseItemsFile(readFileSync(join(ctx.folder, 'items.tsv'), 'utf8'));
  const journal = parseJournalFile(readFileSync(join(ctx.folder, 'journal.tsv'), 'utf8'));
  const session = parseSessionFile(readFileSync(join(ctx.folder, 'session'), 'utf8'));

  expect({
    exitCodes: results.map((result) => result.exitCode),
    itemIDs: items.kind === 'items' ? items.items.map((item) => item.id).toSorted() : items,
    journalOps: journal.map((row) => row.op).toSorted(),
    sessionKind: session.kind,
    files: readdirSync(ctx.folder).toSorted(),
  }).toStrictEqual({
    exitCodes: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    itemIDs: ['t-a', 't-b', 't-c', 't-d', 't-e', 't-f', 'w-a', 'w-b', 'w-c', 'w-d'],
    journalOps: [
      'init',
      ...Array.from({ length: 6 }, () => 'task'),
      ...Array.from({ length: 4 }, () => 'wait'),
    ],
    sessionKind: 'session',
    files: ['items.tsv', 'journal.tsv', 'owner.tsv', 'prs.tsv', 'session'],
  });
});
