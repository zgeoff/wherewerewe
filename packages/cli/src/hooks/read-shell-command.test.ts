import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readShellCommand } from './read-shell-command.ts';

function setupTest() {
  const lines = readFileSync(
    join(import.meta.dir, '../../../../docs/design/wherewerewe/sessions-and-hooks.md'),
    'utf8',
  ).split('\n');

  const start = lines.indexOf('| Command | Gate |');

  return {
    read: (command: string) => readShellCommand(command, 'tide-alerts', 'claude'),
    readCodex: (command: string) => readShellCommand(command, 'tide-alerts', 'codex'),
    examples: lines.slice(start + 2, start + 10).map((line) =>
      line
        .split(/(?<!\\)\|/u)
        .slice(1, -1)
        .map((cell) => cell.trim()),
    ),
  };
}

test('it finds the worked examples of the design by their header row', () => {
  const ctx = setupTest();

  expect(ctx.examples).toHaveLength(8);
});

test.each([0, 1, 2, 3, 4, 5, 6])(
  'it gives the gate the design gives for worked example %i',
  (row) => {
    const ctx = setupTest();
    const [command = '', gate = ''] = ctx.examples[row] ?? [];
    const text = command.replace(/^`/u, '').replace(/`$/u, '');

    expect(ctx.read(text) === 'other').toBe(gate.startsWith('gated'));
  },
);

test('it gates the example whose backslash and line break hide a command substitution', () => {
  const ctx = setupTest();

  expect(ctx.read('www task t-a "$\\\n(date)"')).toBe('other');
});

test.each([
  { command: 'www', kind: 'brief-command' },
  { command: 'wherewerewe', kind: 'brief-command' },
  { command: '/usr/local/bin/wherewerewe', kind: 'brief-command' },
  { command: 'www --session tide-alerts', kind: 'brief-command' },
  { command: 'www --session=tide-alerts', kind: 'brief-command' },
  { command: 'www --session other', kind: 'www-command' },
  { command: 'www --json', kind: 'www-command' },
  { command: 'www help', kind: 'www-command' },
  { command: 'www | tail -1', kind: 'www-command' },
  { command: 'www | grep -v NOW | head -20', kind: 'www-command' },
  { command: 'www | sort | wc -l', kind: 'www-command' },
  { command: 'www | cat', kind: 'other' },
  { command: 'www > brief.txt', kind: 'www-command' },
  { command: 'www 2>&1', kind: 'www-command' },
  { command: 'www &> all.txt', kind: 'www-command' },
  { command: 'www 2>/dev/null | head', kind: 'www-command' },
  { command: 'FOO=1 www', kind: 'other' },
  { command: 'www |& tail', kind: 'other' },
  { command: 'www <<EOF', kind: 'other' },
  { command: "www $'x'", kind: 'other' },
  { command: 'www "unclosed', kind: 'other' },
  { command: 'www # a comment', kind: 'other' },
  { command: 'www && ls', kind: 'other' },
  { command: 'www & ls', kind: 'other' },
  { command: 'www || ls', kind: 'other' },
  { command: 'ls', kind: 'other' },
  { command: 'wwwx', kind: 'other' },
  { command: 'bin/www', kind: 'other' },
  { command: 'www `date`', kind: 'other' },
  { command: 'www <(ls)', kind: 'other' },
  { command: '', kind: 'other' },
] as const)('it sorts $command as $kind', (row) => {
  const ctx = setupTest();

  expect(ctx.read(row.command)).toBe(row.kind);
});

test.each([
  { command: "bash -lc 'www'", kind: 'brief-command' },
  { command: "/bin/zsh -c 'www --session tide-alerts'", kind: 'brief-command' },
  { command: "sh -c 'www | tail -1'", kind: 'www-command' },
  { command: "bash -lc 'www; ls'", kind: 'other' },
  { command: "fish -c 'www'", kind: 'other' },
  { command: 'bash -lc www', kind: 'other' },
  { command: "bash -lc 'www' 'x'", kind: 'other' },
] as const)('it reads the Codex wrapper in $command as $kind', (row) => {
  const ctx = setupTest();

  expect(ctx.readCodex(row.command)).toBe(row.kind);
});

test('it reads no wrapper on Claude Code', () => {
  const ctx = setupTest();

  expect(ctx.read("bash -lc 'www'")).toBe('other');
});
