import { expect, test } from 'bun:test';
import { buildWorstCaseBriefInput } from './build-worst-case-brief-input.ts';

test('it builds the worst case with the tasks and the host the test names', () => {
  const input = buildWorstCaseBriefInput({ host: 'claude', taskCount: 30 });

  expect({
    host: input.host,
    tasks: input.items.filter((item) => item.kind === 'task'),
    goal: input.session.goal,
  }).toStrictEqual({
    host: 'claude',
    tasks: expect.toBeArrayOfSize(30),
    goal: expect.toBeString(),
  });
});
