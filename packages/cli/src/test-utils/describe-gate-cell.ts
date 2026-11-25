import { match } from 'ts-pattern';
import type { GateCell, GateColumn, GateState } from '../hooks/types.ts';

const injection =
  '`wiped`, `spare=1`, `reads` kept; prints the [injection](#the-www-commands-the-refusal-and-the-injection)';

// The phrase that the design's state table holds for a typed cell. A cell it has no phrase for
// comes back as `?`, which no row of the table reads.
export function describeGateCell(cell: GateCell, column: GateColumn, state: GateState): string {
  if (column === 'session-start') {
    return state === 'wiped' && cell.kind === 'go' && cell.output === 'inject'
      ? injection
      : 'the same';
  }

  return match(cell)
    .with({ kind: 'go' }, (go) => describeGo(go))
    .with({ kind: 'when-reads-zero' }, (waiting) => `\`${waiting.next}\` when \`reads\` reaches 0`)
    .with(
      { kind: 'by-spare' },
      (bySpare) =>
        `with \`spare=1\`, ${describeSpare(bySpare.spare1)}; with \`spare=0\`, ${describeSpare(bySpare.spare0)}`,
    )
    .with(
      { kind: 'by-stop-active' },
      (byActive) =>
        `${describeStop(byActive.inactive)} when \`stop_hook_active\` is false; when it is true, ${describeStop(byActive.active)}`,
    )
    .exhaustive();
}

function describeGo(cell: Extract<GateCell, { kind: 'go' }>): string {
  const state = cell.next === 'same' ? null : `\`${cell.next}\``;

  return match(cell.output)
    .with('refuse', () => 'refused')
    .with('pass', () => (state === null ? 'passes' : `${state}; passes`))
    .with('pass-with-line', () => `${state ?? ''}; passes with the line`)
    .with('none', () => state ?? 'no change')
    .with('block', () => '?')
    .with('inject', () => '?')
    .exhaustive();
}

function describeSpare(cell: GateCell): string {
  return match(cell)
    .with(
      { kind: 'go', output: 'refuse', reason: 'cut' },
      () => 'refused with the cut reason and `spare=0`',
    )
    .with(
      { kind: 'go', next: 'open', output: 'pass-with-line' },
      () => '`open`, and passes with the line',
    )
    .otherwise(() => '?');
}

function describeStop(cell: GateCell): string {
  return match(cell)
    .with({ kind: 'go', output: 'block' }, () => 'blocks')
    .with({ kind: 'go', next: 'failed', output: 'pass' }, () => '`failed`, and passes')
    .otherwise(() => '?');
}
