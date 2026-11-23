import { expect, test } from 'bun:test';
import { buildMockItem } from './build-mock-item.ts';

test('it builds an unchecked task with the named fields laid over it', () => {
  const item = buildMockItem({ id: 'w-a', kind: 'wait', extra: { who: 'owner' } });

  expect(item).toStrictEqual({
    id: 'w-a',
    kind: 'wait',
    claim: 'Write the parser',
    check: null,
    atWrite: null,
    last: null,
    written: '2026-03-10T10:31:09Z',
    by: 'agent',
    extra: { who: 'owner' },
  });
});
