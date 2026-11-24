import { expect, test } from 'bun:test';
import { buildOverLimitBriefInput } from './build-over-limit-brief-input.ts';

test('it builds the tasks and the focus note the options name', () => {
  const input = buildOverLimitBriefInput({
    taskCount: 3,
    focus: 'task01xxxxxxxxxx',
    claimLength: 10,
  });

  expect({
    kinds: input.items.map((item) => item.kind).join(','),
    claim: input.items[0]?.claim,
    notes: input.notes.map((note) => note.id),
    now: input.session.now,
  }).toStrictEqual({
    kinds: 'task,task,task,wait,wait,wait,wait,ok,rule,rule,rule,rule,rule,where,where,where,where',
    claim: 'cccccccccc',
    notes: ['task01xxxxxxxxxx'],
    now: 'task01xxxxxxxxxx',
  });
});

test('it builds no note when no item is in focus', () => {
  const input = buildOverLimitBriefInput({ taskCount: 1, focus: null });

  expect(input.notes).toStrictEqual([]);
});
