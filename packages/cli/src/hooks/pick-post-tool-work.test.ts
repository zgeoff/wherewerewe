import { expect, test } from 'bun:test';
import { pickPostToolWork } from './pick-post-tool-work.ts';

function setupTest() {
  return { pick: pickPostToolWork };
}

test.each([
  { command: 'www init tide-alerts --goal "Ship it"', bind: { name: 'tide-alerts', verb: 'init' } },
  { command: 'www attach tide-alerts', bind: { name: 'tide-alerts', verb: 'attach' } },
  {
    command: '/usr/local/bin/wherewerewe import tide-alerts',
    bind: { name: 'tide-alerts', verb: 'import' },
  },
  { command: 'www init', bind: null },
  { command: 'www init BAD_NAME', bind: null },
  { command: 'www task t-a "x"', bind: null },
  { command: 'cat www init tide-alerts', bind: null },
])('it reads the bind of $command', (row) => {
  const ctx = setupTest();

  expect(ctx.pick(row.command, '', 'claude').bind).toStrictEqual(row.bind);
});

test.each([
  { command: 'git push origin tide-fix', nudge: true },
  { command: 'git -C ../app push', nudge: true },
  { command: 'gh pr create --fill', nudge: true },
  { command: 'gh pr merge 12 --squash', nudge: true },
  { command: 'git status', nudge: false },
  { command: 'echo "git push"', nudge: false },
  { command: 'gh pr view 12', nudge: false },
])('it marks $command as a nudge command: $nudge', (row) => {
  const ctx = setupTest();

  expect(ctx.pick(row.command, '', 'claude').isNudgeCommand).toBe(row.nudge);
});

test('it finds the first pull request address in the output of gh pr create', () => {
  const ctx = setupTest();

  const response =
    'Creating pull request\nhttps://github.com/bosunhq/bosun-api/pull/77\nsee https://github.com/other/repo/pull/3';

  expect(ctx.pick('gh pr create --fill', response, 'claude').prRef).toBe('bosunhq/bosun-api#77');
});

test('it reads no pull request address when the command is not gh pr create', () => {
  const ctx = setupTest();

  expect(
    ctx.pick('gh pr view 77', 'https://github.com/bosunhq/bosun-api/pull/77', 'claude').prRef,
  ).toBeNull();
});

test('it reads a command in a Codex wrapper', () => {
  const ctx = setupTest();

  expect(ctx.pick("bash -lc 'www attach tide-alerts'", '', 'codex').bind).toStrictEqual({
    name: 'tide-alerts',
    verb: 'attach',
  });
});
