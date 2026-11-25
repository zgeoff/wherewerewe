import { expect, test } from 'bun:test';
import { collectSimpleCommands } from './collect-simple-commands.ts';

function setupTest() {
  return { collect: collectSimpleCommands };
}

test.each([
  { command: 'git push', commands: [['git', 'push']] },
  {
    command: 'git add . && git commit -m "fix it" || echo no',
    commands: [
      ['git', 'add', '.'],
      ['git', 'commit', '-m', 'fix it'],
      ['echo', 'no'],
    ],
  },
  {
    command: 'cd app; gh pr create --fill',
    commands: [
      ['cd', 'app'],
      ['gh', 'pr', 'create', '--fill'],
    ],
  },
  { command: 'FOO=1 BAR=2 gh pr create', commands: [['gh', 'pr', 'create']] },
  { command: '(gh pr create) | cat', commands: [['gh', 'pr', 'create'], ['cat']] },
  { command: 'echo \'a && b\' "c; d"', commands: [['echo', 'a && b', 'c; d']] },
  { command: String.raw`echo a\ b`, commands: [['echo', 'a b']] },
  {
    command: 'git status\ngit push',
    commands: [
      ['git', 'status'],
      ['git', 'push'],
    ],
  },
  { command: "cat <<'EOF'\ngh pr create\nEOF", commands: [['cat']] },
  { command: '', commands: [] },
])('it collects the simple commands of $command', (row) => {
  const ctx = setupTest();

  expect(ctx.collect(row.command)).toStrictEqual(row.commands);
});
