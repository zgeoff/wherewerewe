import type { GateCell, GateColumn, GateState } from './types.ts';

const sameNone: GateCell = { kind: 'go', next: 'same', output: 'none' };
const passes: GateCell = { kind: 'go', next: 'same', output: 'pass' };
const refused: GateCell = { kind: 'go', next: 'same', output: 'refuse', reason: 'standard' };
const reading: GateCell = { kind: 'go', next: 'reading', output: 'pass' };
const read: GateCell = { kind: 'go', next: 'read', output: 'none' };
const startOver: GateCell = { kind: 'go', next: 'wiped', output: 'inject' };
const failedStop: GateCell = { kind: 'go', next: 'failed', output: 'pass' };
const opensWithLine: GateCell = { kind: 'go', next: 'open', output: 'pass-with-line' };

const closedOnSpent: GateCell = {
  kind: 'by-spare',
  spare1: { kind: 'go', next: 'same', output: 'refuse', reason: 'cut' },
  spare0: opensWithLine,
};

const settled: Readonly<Record<GateColumn, GateCell>> = {
  'session-start': startOver,
  'brief-command': passes,
  'other-call': passes,
  whole: read,
  cut: sameNone,
  failed: sameNone,
  stop: passes,
};

// The state table of sessions-and-hooks.md, "The gate's states", one cell per state and column.
// The reads and spare rules apply to every state alike, so they live in the step function.
export const gateTable: Readonly<Record<GateState, Readonly<Record<GateColumn, GateCell>>>> = {
  wiped: {
    ...settled,
    'brief-command': reading,
    'other-call': refused,
    stop: {
      kind: 'by-stop-active',
      inactive: { kind: 'go', next: 'same', output: 'block' },
      active: failedStop,
    },
  },
  reading: {
    ...settled,
    'other-call': refused,
    cut: { kind: 'when-reads-zero', next: 'cut' },
    failed: { kind: 'when-reads-zero', next: 'failed' },
    stop: failedStop,
  },
  cut: { ...settled, 'brief-command': reading, 'other-call': closedOnSpent },
  failed: { ...settled, 'other-call': opensWithLine },
  read: settled,
  open: settled,
};
