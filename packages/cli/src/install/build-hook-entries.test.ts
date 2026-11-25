import { expect, test } from 'bun:test';
import { buildHookEntries } from './build-hook-entries.ts';
import { buildHookGroup } from './build-hook-group.ts';

function setupTest() {
  return { bin: '/opt/tools/bin/wherewerewe' };
}

test.each([
  {
    harness: 'claude',
    rows: [
      'SessionStart:-:5',
      'PreToolUse:-:3',
      'PostToolUse:Bash:5',
      'PostToolUseFailure:Bash:5',
      'SubagentStart:-:5',
      'Stop:-:3',
    ],
  },
  {
    harness: 'codex',
    rows: [
      'SessionStart:-:5',
      'PreToolUse:-:3',
      'PostToolUse:Bash:5',
      'SubagentStart:-:5',
      'Stop:-:3',
    ],
  },
] as const)('it gives each $harness entry the matcher and timeout of the events table', (row) => {
  const ctx = setupTest();

  const rows = buildHookEntries(row.harness, ctx.bin).map(
    (entry) => `${entry.event}:${entry.matcher ?? '-'}:${String(entry.timeoutSeconds)}`,
  );

  expect(rows).toStrictEqual([...row.rows]);
});

test.each(['claude', 'codex'] as const)('it gives every %s entry one command', (harness) => {
  const ctx = setupTest();
  const commands = buildHookEntries(harness, ctx.bin).map((entry) => entry.command);

  expect([...new Set(commands)]).toStrictEqual([`/opt/tools/bin/wherewerewe hook ${harness}`]);
});

test('it quotes a bin path that holds a space as one shell word', () => {
  const [entry] = buildHookEntries('claude', "/opt/my tools/it's/wherewerewe");

  expect(entry?.command).toBe(String.raw`'/opt/my tools/it'\''s/wherewerewe' hook claude`);
});

test('it builds a group with the matcher first and one command handler', () => {
  const ctx = setupTest();
  const entries = buildHookEntries('codex', ctx.bin);
  const entry = entries.find((found) => found.event === 'PostToolUse');
  const group = entry === undefined ? null : JSON.stringify(buildHookGroup(entry));

  expect(group).toBe(
    '{"matcher":"Bash","hooks":[{"type":"command","command":"/opt/tools/bin/wherewerewe hook codex","timeout":5}]}',
  );
});

test('it builds a group with no matcher key for an entry with none', () => {
  const ctx = setupTest();
  const [entry] = buildHookEntries('claude', ctx.bin);
  const group = entry === undefined ? null : JSON.stringify(buildHookGroup(entry));

  expect(group).toBe(
    '{"hooks":[{"type":"command","command":"/opt/tools/bin/wherewerewe hook claude","timeout":5}]}',
  );
});
