import { expect, test } from 'bun:test';
import { readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { run } from '@zgeoff/testing/process';
import { buildClaimPath } from '../src/store/build-claim-path.ts';
import { runGoneProcess } from '../src/test-utils/run-gone-process.ts';
import { seedLockFile } from '../src/test-utils/seed-lock-file.ts';
import { seedStaleLock } from '../src/test-utils/seed-stale-lock.ts';

function setupTest() {
  const root = createTempDir('stale-takeover').path;
  const lockModule = join(import.meta.dir, '..', 'src', 'store', 'with-store-lock.ts');

  // A writer marks that it is inside the lock, then exits without releasing it, as a crashed
  // writer does, so each writer after the first takes over a stale lock. A writer that finds
  // another's mark leaves an overlap file.
  const contender = `
    import { closeSync, openSync, unlinkSync, writeFileSync } from 'node:fs';
    import { join } from 'node:path';
    import { withStoreLock } from ${JSON.stringify(lockModule)};

    const folder = process.env.LOCK_FOLDER;
    const overlapPath = join(folder, 'overlap-' + String(process.pid));

    const result = await withStoreLock(folder, async () => {
      try {
        closeSync(openSync(join(folder, 'inside'), 'wx'));
      } catch {
        writeFileSync(overlapPath, '');
      }

      await Bun.sleep(5);

      try {
        unlinkSync(join(folder, 'inside'));
      } catch {
        writeFileSync(overlapPath, '');
      }

      process.exit(0);
    }, { waitMs: 10000 });

    process.exitCode = result.kind === 'busy' ? 3 : 1;
  `;

  return {
    root,
    runContenders: async (folder: string) => {
      const results = await Promise.all(
        Array.from({ length: 24 }, () =>
          run([process.execPath, '-e', contender], {
            env: { LOCK_FOLDER: folder },
            timeoutMs: 12_000,
          }),
        ),
      );

      return {
        exitCodes: results.map((result) => result.exitCode),
        overlaps: readdirSync(folder).filter((name) => name.startsWith('overlap-')),
      };
    },
  };
}

// A race shows up in only some rounds, so 16 fresh rounds give it several chances.
test.each(Array.from({ length: 16 }, (_, index) => index + 1))(
  'it lets one writer at a time in when 24 processes take over stale locks, round %i',
  async (round) => {
    const ctx = setupTest();
    const folder = join(ctx.root, String(round));

    await seedStaleLock(folder);

    const outcome = await ctx.runContenders(folder);

    expect(outcome).toStrictEqual({
      exitCodes: Array.from({ length: 24 }, () => 0),
      overlaps: [],
    });
  },
);

// The claim names this test's own pid, which runs, and no start time, as a claim made on a system
// with no /proc whose pid a later process got: only the claim's age shows its writer is gone.
test('it lets one writer at a time in when 24 processes take over a stale lock past an old claim on a running pid with no start time', async () => {
  const ctx = setupTest();

  const pid = await runGoneProcess();

  const seen = seedLockFile(
    ctx.root,
    'lock',
    `pid=${String(pid)} ts=${new Date().toISOString()}\n`,
  );

  const claimPath = buildClaimPath(join(ctx.root, 'lock'), seen);

  seedLockFile(
    ctx.root,
    basename(claimPath),
    `pid=${String(process.pid)} ts=${new Date(Date.now() - 3_600_000).toISOString()}\n`,
  );

  const outcome = await ctx.runContenders(ctx.root);

  expect(outcome).toStrictEqual({
    exitCodes: Array.from({ length: 24 }, () => 0),
    overlaps: [],
  });
});
