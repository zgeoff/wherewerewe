import { expect, test } from 'bun:test';
import { checkPackageRun } from './check-package-run.ts';

function setupTest() {
  return { checkPackageRun };
}

test('it returns the output when the first line is exactly the expected text', () => {
  const ctx = setupTest();
  const output = { exitCode: 0, stdout: 'wherewerewe 0.2.0\nmore\n', stderr: '' };

  expect(ctx.checkPackageRun('www --version', output, 'wherewerewe 0.2.0')).toStrictEqual(output);
});

test.each([
  ['text after the expected line', 'banner EXTRA\n', 'banner'],
  ['a bogus word after the version prefix', 'wherewerewe bogus\n', 'wherewerewe 0.2.0'],
  ['a longer line than the expected one', 'wherewerewe 0.2.0-rc1\n', 'wherewerewe 0.2.0'],
])('it fails with check-failed for %s', (_title, stdout, expected) => {
  const ctx = setupTest();

  expect(() =>
    ctx.checkPackageRun('www --version', { exitCode: 0, stdout, stderr: '' }, expected),
  ).toThrow(expect.objectContaining({ code: 'check-failed' }));
});

test.each([
  ['prints nothing, against an empty expected line', { exitCode: 0, stdout: '', stderr: '' }, ''],
  [
    'prints on stderr',
    { exitCode: 0, stdout: 'wherewerewe 0.2.0\n', stderr: 'a warning\n' },
    'wherewerewe 0.2.0',
  ],
])('it fails with check-failed when the binary %s', (_title, output, expected) => {
  const ctx = setupTest();

  expect(() => ctx.checkPackageRun('www --version', output, expected)).toThrow(
    expect.objectContaining({ code: 'check-failed' }),
  );
});

test('it fails with check-failed when the expected text is on a later line only', () => {
  const ctx = setupTest();

  expect(() =>
    ctx.checkPackageRun(
      'www help',
      { exitCode: 0, stdout: 'a banner\nwww (wherewerewe): a tool\n', stderr: '' },
      'www (wherewerewe)',
    ),
  ).toThrow(expect.objectContaining({ code: 'check-failed' }));
});

test('it fails with check-failed when the binary exits nonzero', () => {
  const ctx = setupTest();

  expect(() =>
    ctx.checkPackageRun(
      'www help',
      { exitCode: 3, stdout: 'www (wherewerewe): a tool\n', stderr: 'boom\n' },
      'www (wherewerewe)',
    ),
  ).toThrow(expect.objectContaining({ code: 'check-failed' }));
});
