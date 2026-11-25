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
  { command: 'echo gh pr create', nudge: false },
  { command: 'echo git push', nudge: false },
  { command: 'git commit -m push', nudge: false },
  { command: 'grep "gh pr merge" notes.txt', nudge: false },
  { command: "cat <<'EOF'\ngit push\nEOF", nudge: false },
  { command: 'git add . && git commit -m x && git push', nudge: true },
  { command: 'cd app; gh pr create --fill', nudge: true },
  { command: 'FOO=1 gh pr create', nudge: true },
  { command: 'gh -R bosunhq/bosun-api pr merge 12', nudge: true },
  { command: 'git -c core.pager=cat push', nudge: true },
  { command: 'gh pr view 12', nudge: false },
  { command: 'gh search repos pr create', nudge: false },
  { command: 'gh issue list pr merge', nudge: false },
  { command: 'gh --repo bosunhq/bosun-api pr create', nudge: true },
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

test('it reads no pull request address from a command that only names gh pr create', () => {
  const ctx = setupTest();

  expect(
    ctx.pick('echo gh pr create', 'https://github.com/example/repo/pull/7', 'claude'),
  ).toStrictEqual({ bind: null, prRef: null, isNudgeCommand: false });
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

test('it reads no pull request address when pr create is only an argument of another gh command', () => {
  const ctx = setupTest();

  expect(
    ctx.pick('gh search repos pr create', 'https://github.com/bosunhq/bosun-api/pull/77', 'claude')
      .prRef,
  ).toBeNull();
});
