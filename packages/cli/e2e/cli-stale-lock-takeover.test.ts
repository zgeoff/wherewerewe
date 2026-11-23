import { expect, test } from 'bun:test';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { run } from '@zgeoff/testing/process';
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
    runRound: async (round: number) => {
      const folder = join(root, String(round));

      await seedStaleLock(folder);

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

    const outcome = await ctx.runRound(round);

    expect(outcome).toStrictEqual({
      exitCodes: Array.from({ length: 24 }, () => 0),
      overlaps: [],
    });
  },
);
