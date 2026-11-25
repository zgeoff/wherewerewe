import { expect, test } from 'bun:test';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { seedInstallFixture } from './seed-install-fixture.ts';

function setupTest() {
  return { seed: seedInstallFixture };
}

test('it seeds a wherewerewe that is no script, a codex and a gh, and a PATH of their folder only', () => {
  const ctx = setupTest();
  const fixture = ctx.seed();

  expect({
    wherewerewe: readFileSync(join(fixture.bin, 'wherewerewe'), 'utf8'),
    isCodexExecutable: statSync(join(fixture.bin, 'codex')).mode % 0o1000 === 0o755,
    isGhExecutable: statSync(join(fixture.bin, 'gh')).mode % 0o1000 === 0o755,
    path: fixture.env['PATH'],
  }).toStrictEqual({
    wherewerewe: 'binary-stub',
    isCodexExecutable: true,
    isGhExecutable: true,
    path: fixture.bin,
  });
});

test('it points the home and the state of the run at the temp folder', async () => {
  const ctx = setupTest();
  const fixture = ctx.seed();

  const result = await fixture.run(['install', '--print']);

  expect({
    exitCode: result.exitCode,
    isUnderRoot: fixture.paths.claudeSettings.startsWith(fixture.root),
    storeRoot: fixture.storeRoot.startsWith(fixture.root),
  }).toStrictEqual({ exitCode: 0, isUnderRoot: true, storeRoot: true });
});
