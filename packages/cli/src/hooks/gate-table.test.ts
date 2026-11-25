import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describeGateCell } from '../test-utils/describe-gate-cell.ts';
import { gateTable } from './gate-table.ts';

function setupTest() {
  const lines = readFileSync(
    join(import.meta.dir, '../../../../docs/design/wherewerewe/sessions-and-hooks.md'),
    'utf8',
  ).split('\n');

  const header =
    '| State | `SessionStart` | brief command | other call | whole | cut | failed | `Stop` |';

  const start = lines.indexOf(header);

  return {
    docRows: new Map(
      lines
        .slice(start + 2, start + 7)
        .map((line) =>
          line
            .split(/(?<!\\)\|/u)
            .slice(1, -1)
            .map((cell) => cell.trim()),
        )
        .map(([label, ...cells]) => [label ?? '', cells]),
    ),
    columns: [
      'session-start',
      'brief-command',
      'other-call',
      'whole',
      'cut',
      'failed',
      'stop',
    ] as const,
  };
}

test('it finds the state table by its header row in the design', () => {
  const ctx = setupTest();

  expect([...ctx.docRows.keys()]).toStrictEqual([
    '`wiped`',
    '`reading`',
    '`cut`',
    '`failed`',
    '`read`, `open`',
  ]);
});

test.each([
  { label: '`wiped`', state: 'wiped' },
  { label: '`reading`', state: 'reading' },
  { label: '`cut`', state: 'cut' },
  { label: '`failed`', state: 'failed' },
  { label: '`read`, `open`', state: 'read' },
  { label: '`read`, `open`', state: 'open' },
] as const)('it holds the design cells of the $state row, column by column', (row) => {
  const ctx = setupTest();

  const cells = ctx.columns.map((column) =>
    describeGateCell(gateTable[row.state][column], column, row.state),
  );

  expect(cells).toStrictEqual(ctx.docRows.get(row.label) ?? []);
});
