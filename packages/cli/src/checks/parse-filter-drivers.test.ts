import { expect, test } from 'bun:test';
import { parseFilterDrivers } from './parse-filter-drivers.ts';

function setupTest() {
  return { parseFilterDrivers };
}

test.each([
  {
    title: 'no key, as exit 1',
    command: { kind: 'exit', code: 1, stdout: '', stderr: '' },
    expected: { kind: 'drivers', names: [] },
  },
  {
    title: 'the repo, worktree and command drivers, each name once and sorted',
    command: {
      kind: 'exit',
      code: 0,
      stdout:
        'local\tfilter.x.clean\nlocal\tfilter.x.process\nworktree\tfilter.lfs-2.smudge\ncommand\tfilter.a.b.clean\n',
      stderr: '',
    },
    expected: { kind: 'drivers', names: ['a.b', 'lfs-2', 'x'] },
  },
  {
    title: "the owner's global and system drivers left on",
    command: {
      kind: 'exit',
      code: 0,
      stdout: 'global\tfilter.lfs.clean\nsystem\tfilter.lfs.process\nlocal\tfilter.x.clean\n',
      stderr: '',
    },
    expected: { kind: 'drivers', names: ['x'] },
  },
  {
    title: 'a name with a space, which -c could not name alone',
    command: { kind: 'exit', code: 0, stdout: 'local\tfilter.a b.clean\n', stderr: '' },
    expected: { kind: 'unreadable' },
  },
  {
    title: 'a name with an equals sign',
    command: { kind: 'exit', code: 0, stdout: 'local\tfilter.a=b.clean\n', stderr: '' },
    expected: { kind: 'unreadable' },
  },
  {
    title: 'a line that is not a scope and a key',
    command: { kind: 'exit', code: 0, stdout: 'filter.x.clean\n', stderr: '' },
    expected: { kind: 'unreadable' },
  },
  {
    title: 'a config git cannot read',
    command: { kind: 'exit', code: 3, stdout: '', stderr: 'fatal: bad config line 2' },
    expected: { kind: 'unreadable' },
  },
  {
    title: 'exit 1 with a listing',
    command: { kind: 'exit', code: 1, stdout: 'local\tfilter.x.clean\n', stderr: '' },
    expected: { kind: 'unreadable' },
  },
  { title: 'a timeout', command: { kind: 'timeout' }, expected: { kind: 'unreadable' } },
  { title: 'no git', command: { kind: 'missing' }, expected: { kind: 'git missing' } },
] as const)('it reads $title', (row) => {
  const ctx = setupTest();

  expect(ctx.parseFilterDrivers(row.command)).toStrictEqual(row.expected);
});
