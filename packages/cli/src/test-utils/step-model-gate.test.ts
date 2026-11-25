import { expect, test } from 'bun:test';
import { stepModelGate } from './step-model-gate.ts';

function setupTest() {
  return { step: stepModelGate };
}

test.each([
  {
    title: 'refuses an other call in wiped',
    gate: { state: 'wiped', reads: 0, spare: 1, stopActive: false },
    event: 'PreOther',
    state: 'wiped',
    output: 'refuse-standard',
  },
  {
    title: 'opens a failed gate on an other call, with the line',
    gate: { state: 'failed', reads: 0, spare: 1, stopActive: false },
    event: 'PreOther',
    state: 'open',
    output: 'pass+line',
  },
  {
    title: 'blocks a Stop in wiped once',
    gate: { state: 'wiped', reads: 0, spare: 1, stopActive: false },
    event: 'Stop',
    state: 'wiped',
    output: 'block',
  },
  {
    title: 'fails a Stop in wiped that already blocked',
    gate: { state: 'wiped', reads: 0, spare: 1, stopActive: true },
    event: 'Stop',
    state: 'failed',
    output: 'none',
  },
  {
    title: 'stays in reading while a second read runs',
    gate: { state: 'reading', reads: 2, spare: 1, stopActive: false },
    event: 'PostFailed',
    state: 'reading',
    output: 'none',
  },
] as const)('it $title', (row) => {
  const ctx = setupTest();
  const [gate, output] = ctx.step(row.gate, row.event);

  expect({ state: gate.state, output }).toStrictEqual({ state: row.state, output: row.output });
});
