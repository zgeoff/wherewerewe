import { expect, test } from 'bun:test';
import { checkWWWHelp } from './check-www-help.ts';

test('it returns the exit code and first line when the first line matches', () => {
  const output = checkWWWHelp(
    { exitCode: 0, stdout: 'acme (ac): a tool\n\nUsage:\n', stderr: '' },
    'acme (ac): a tool',
  );

  expect(output).toStrictEqual({ exitCode: 0, firstLine: 'acme (ac): a tool' });
});

test('it fails with check-failed when the first line differs', () => {
  expect(() => checkWWWHelp({ exitCode: 0, stdout: 'other text\n', stderr: '' }, 'acme')).toThrow(
    expect.objectContaining({
      code: 'check-failed',
      message: 'www help printed "other text" as its first line, not "acme"',
    }),
  );
});

test('it fails with check-failed and the stderr when www exits nonzero', () => {
  expect(() =>
    checkWWWHelp({ exitCode: 2, stdout: 'acme\n', stderr: 'boom happened\n' }, 'acme'),
  ).toThrow(
    expect.objectContaining({ code: 'check-failed', message: 'www help exited 2: boom happened' }),
  );
});
