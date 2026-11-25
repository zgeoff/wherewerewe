import { expect, test } from 'bun:test';
import { checkPackageInstall } from './check-package-install.ts';

function setupTest() {
  const run = { stateRoot: '/runs/a run', target: 'linux-x64', version: '0.2.0' };

  return {
    run,
    checkPackageInstall,
    stdout: [
      'wherewerewe: downloading file:///runs/a%20run/release/wherewerewe-linux-x64',
      'wherewerewe: installed wherewerewe 0.2.0 to /runs/a run/bin/wherewerewe',
      'wherewerewe: add /runs/a run/bin to your PATH',
      '',
    ].join('\n'),
  };
}

test('it returns the output when install.sh printed exactly its three lines for this version', () => {
  const ctx = setupTest();
  const output = { exitCode: 0, stdout: ctx.stdout, stderr: '' };

  expect(ctx.checkPackageInstall(output, ctx.run)).toStrictEqual(output);
});

test.each([
  ['another version', (stdout: string) => stdout.replace('0.2.0', '0.2.0-rc1')],
  ['a line more', (stdout: string) => `${stdout}wherewerewe: one more\n`],
  ['the installed line alone', (stdout: string) => stdout.split('\n')[1] ?? ''],
  [
    'another install folder',
    (stdout: string) => stdout.replace('to /runs/a run/bin', 'to /elsewhere'),
  ],
])('it fails with check-failed for %s', (_title, change) => {
  const ctx = setupTest();

  expect(() =>
    ctx.checkPackageInstall({ exitCode: 0, stdout: change(ctx.stdout), stderr: '' }, ctx.run),
  ).toThrow(expect.objectContaining({ code: 'check-failed' }));
});

test('it fails with check-failed when install.sh prints anything on stderr', () => {
  const ctx = setupTest();

  expect(() =>
    ctx.checkPackageInstall({ exitCode: 0, stdout: ctx.stdout, stderr: 'a warning\n' }, ctx.run),
  ).toThrow(expect.objectContaining({ code: 'check-failed' }));
});

test('it fails with check-failed when install.sh exits other than 0', () => {
  const ctx = setupTest();

  expect(() =>
    ctx.checkPackageInstall({ exitCode: 1, stdout: ctx.stdout, stderr: 'boom\n' }, ctx.run),
  ).toThrow(expect.objectContaining({ code: 'check-failed' }));
});
