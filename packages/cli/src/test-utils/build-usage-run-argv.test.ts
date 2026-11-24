import { expect, test } from 'bun:test';
import { buildUsageRunArgv } from './build-usage-run-argv.ts';

function setupTest() {
  return { buildUsageRunArgv };
}

test('it leaves out each optional group and fills each placeholder', () => {
  const ctx = setupTest();

  const argv = ctx.buildUsageRunArgv(
    'Run: www task <id> "<claim>" [<check>] [--blocked-by <id>] [--note "<detail>" [--owed]]',
    { '<id>': 't-a', '<claim>': 'Write it' },
  );

  expect(argv).toStrictEqual(['task', 't-a', 'Write it']);
});

test('it keeps an optional group named in keeps, without its brackets, and leaves out the rest', () => {
  const ctx = setupTest();

  const argv = ctx.buildUsageRunArgv(
    'Run: www grant [--may "<words>"] [--not "<words>"] --where <where>',
    { '<words>': 'merge it', '<where>': 'chat' },
    ['--may'],
  );

  expect(argv).toStrictEqual(['grant', '--may', 'merge it', '--where', 'chat']);
});

test('it keeps a one-word optional group named in keeps', () => {
  const ctx = setupTest();

  const argv = ctx.buildUsageRunArgv(
    'Run: www set <id> ["<claim>"] [<check>]',
    {
      '<id>': 't-a',
      '<claim>': 'Write it',
    },
    ['<claim>'],
  );

  expect(argv).toStrictEqual(['set', 't-a', 'Write it']);
});

test('it fills a choice placeholder with its first choice', () => {
  const ctx = setupTest();
  const argv = ctx.buildUsageRunArgv('Run: www list <tasks|waits|prs>', {});

  expect(argv).toStrictEqual(['list', 'tasks']);
});

test('it throws on a placeholder with no fill', () => {
  const ctx = setupTest();

  expect(() => ctx.buildUsageRunArgv('Run: www done <id>', {})).toThrow(
    'no fill for the placeholder <id>',
  );
});
