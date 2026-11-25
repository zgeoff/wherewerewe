import { expect, test } from 'bun:test';
import { stepGate } from './step-gate.ts';

function setupTest() {
  return { step: stepGate };
}

test.each([
  {
    title: 'a brief command in wiped starts a read',
    file: { state: 'wiped', session: 'tide-alerts', reads: 0, spare: 1 },
    event: { kind: 'call', call: 'brief-command' },
    result: {
      file: { state: 'reading', session: 'tide-alerts', reads: 1, spare: 1 },
      output: { kind: 'pass' },
    },
  },
  {
    title: 'an other call in wiped is refused with no write',
    file: { state: 'wiped', session: 'tide-alerts', reads: 0, spare: 1 },
    event: { kind: 'call', call: 'other-call' },
    result: { file: null, output: { kind: 'refuse', reason: 'standard' } },
  },
  {
    title: 'a whole end in wiped is a read, at reads 0',
    file: { state: 'wiped', session: 'tide-alerts', reads: 0, spare: 1 },
    event: { kind: 'end', end: 'whole' },
    result: {
      file: { state: 'read', session: 'tide-alerts', reads: 0, spare: 1 },
      output: { kind: 'none' },
    },
  },
  {
    title: 'a cut end in wiped changes nothing',
    file: { state: 'wiped', session: 'tide-alerts', reads: 0, spare: 1 },
    event: { kind: 'end', end: 'cut' },
    result: { file: null, output: { kind: 'none' } },
  },
  {
    title: 'a Stop in wiped blocks',
    file: { state: 'wiped', session: 'tide-alerts', reads: 0, spare: 1 },
    event: { kind: 'stop', stopHookActive: false },
    result: { file: null, output: { kind: 'block' } },
  },
  {
    title: 'a Stop in wiped with stop_hook_active set fails the gate',
    file: { state: 'wiped', session: 'tide-alerts', reads: 0, spare: 1 },
    event: { kind: 'stop', stopHookActive: true },
    result: {
      file: { state: 'failed', session: 'tide-alerts', reads: 0, spare: 1 },
      output: { kind: 'pass' },
    },
  },
  {
    title: 'a cut end of the last read in reading is cut',
    file: { state: 'reading', session: 'tide-alerts', reads: 1, spare: 1 },
    event: { kind: 'end', end: 'cut' },
    result: {
      file: { state: 'cut', session: 'tide-alerts', reads: 0, spare: 1 },
      output: { kind: 'none' },
    },
  },
  {
    title: 'a failed end with a second read in flight stays in reading',
    file: { state: 'reading', session: 'tide-alerts', reads: 2, spare: 1 },
    event: { kind: 'end', end: 'failed' },
    result: {
      file: { state: 'reading', session: 'tide-alerts', reads: 1, spare: 1 },
      output: { kind: 'none' },
    },
  },
  {
    title: 'a Stop in reading sets reads to 0 and fails the gate',
    file: { state: 'reading', session: 'tide-alerts', reads: 3, spare: 1 },
    event: { kind: 'stop', stopHookActive: false },
    result: {
      file: { state: 'failed', session: 'tide-alerts', reads: 0, spare: 1 },
      output: { kind: 'pass' },
    },
  },
  {
    title: 'an other call in cut with the spare refuses with the cut reason and spends it',
    file: { state: 'cut', session: 'tide-alerts', reads: 0, spare: 1 },
    event: { kind: 'call', call: 'other-call' },
    result: {
      file: { state: 'cut', session: 'tide-alerts', reads: 0, spare: 0 },
      output: { kind: 'refuse', reason: 'cut' },
    },
  },
  {
    title: 'an other call in cut with no spare opens the gate with the line',
    file: { state: 'cut', session: 'tide-alerts', reads: 0, spare: 0 },
    event: { kind: 'call', call: 'other-call' },
    result: {
      file: { state: 'open', session: 'tide-alerts', reads: 0, spare: 0 },
      output: { kind: 'pass-with-line' },
    },
  },
  {
    title: 'a brief command in cut starts a read again',
    file: { state: 'cut', session: 'tide-alerts', reads: 0, spare: 0 },
    event: { kind: 'call', call: 'brief-command' },
    result: {
      file: { state: 'reading', session: 'tide-alerts', reads: 1, spare: 0 },
      output: { kind: 'pass' },
    },
  },
  {
    title: 'an other call in failed opens the gate with the line',
    file: { state: 'failed', session: 'tide-alerts', reads: 0, spare: 1 },
    event: { kind: 'call', call: 'other-call' },
    result: {
      file: { state: 'open', session: 'tide-alerts', reads: 0, spare: 1 },
      output: { kind: 'pass-with-line' },
    },
  },
  {
    title: 'an other call in read passes with no write',
    file: { state: 'read', session: 'tide-alerts', reads: 0, spare: 1 },
    event: { kind: 'call', call: 'other-call' },
    result: { file: null, output: { kind: 'pass' } },
  },
  {
    title: 'a failed end with no read in flight keeps reads at 0 and writes nothing',
    file: { state: 'read', session: 'tide-alerts', reads: 0, spare: 1 },
    event: { kind: 'end', end: 'failed' },
    result: { file: null, output: { kind: 'none' } },
  },
  {
    title: 'a session start keeps reads, sets spare to 1 and wipes',
    file: { state: 'cut', session: 'tide-alerts', reads: 2, spare: 0 },
    event: { kind: 'session-start' },
    result: {
      file: { state: 'wiped', session: 'tide-alerts', reads: 2, spare: 1 },
      output: { kind: 'inject' },
    },
  },
  {
    title: 'a www command after a read of another session is read as wiped and written back',
    file: { state: 'read', session: 'docs-move', reads: 2, spare: 0 },
    event: { kind: 'call', call: 'www-command' },
    result: {
      file: { state: 'wiped', session: 'tide-alerts', reads: 2, spare: 1 },
      output: { kind: 'pass' },
    },
  },
  {
    title: 'an other call after a read of another session is refused, as in wiped',
    file: { state: 'read', session: 'docs-move', reads: 0, spare: 0 },
    event: { kind: 'call', call: 'other-call' },
    result: {
      file: { state: 'wiped', session: 'tide-alerts', reads: 0, spare: 1 },
      output: { kind: 'refuse', reason: 'standard' },
    },
  },
] as const)('it handles $title', (row) => {
  const ctx = setupTest();

  expect(ctx.step(row.file, 'tide-alerts', row.event, null)).toStrictEqual(row.result);
});

test.each([
  { title: 'a call', event: { kind: 'call', call: 'other-call' }, output: { kind: 'pass' } },
  { title: 'a Stop', event: { kind: 'stop', stopHookActive: false }, output: { kind: 'none' } },
  { title: 'a whole end', event: { kind: 'end', end: 'whole' }, output: { kind: 'none' } },
] as const)('it writes nothing for $title of a subagent', (row) => {
  const ctx = setupTest();
  const file = { state: 'wiped', session: 'tide-alerts', reads: 0, spare: 1 } as const;

  expect(ctx.step(file, 'tide-alerts', row.event, 'sub-1')).toStrictEqual({
    file: null,
    output: row.output,
  });
});

test('it writes a wiped file and injects for a session start with no file', () => {
  const ctx = setupTest();

  expect(ctx.step(null, 'tide-alerts', { kind: 'session-start' }, null)).toStrictEqual({
    file: { state: 'wiped', session: 'tide-alerts', reads: 0, spare: 1 },
    output: { kind: 'inject' },
  });
});

test.each([
  { title: 'an other call', event: { kind: 'call', call: 'other-call' }, output: { kind: 'pass' } },
  {
    title: 'a brief command',
    event: { kind: 'call', call: 'brief-command' },
    output: { kind: 'pass' },
  },
  { title: 'a Stop', event: { kind: 'stop', stopHookActive: false }, output: { kind: 'none' } },
  { title: 'a whole end', event: { kind: 'end', end: 'whole' }, output: { kind: 'none' } },
] as const)('it writes nothing for $title with no file', (row) => {
  const ctx = setupTest();

  expect(ctx.step(null, 'tide-alerts', row.event, null)).toStrictEqual({
    file: null,
    output: row.output,
  });
});
