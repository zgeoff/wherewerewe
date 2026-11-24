import { expect, test } from 'bun:test';
import { buildMockItem } from '../test-utils/build-mock-item.ts';
import { pickChangedItems } from './pick-changed-items.ts';

test('it picks an item whose result this read differs from at_write, with that result', () => {
  const item = buildMockItem({ id: 't-a', check: 'pid:5', atWrite: 'alive' });

  expect(pickChangedItems([item], new Map([['t-a', 'gone']]))).toStrictEqual([
    { item, result: 'gone' },
  ]);
});

test('it picks nothing for a result equal to at_write', () => {
  const item = buildMockItem({ id: 't-a', check: 'pid:5', atWrite: 'alive', last: 'gone' });

  expect(pickChangedItems([item], new Map([['t-a', 'alive']]))).toStrictEqual([]);
});

test('it keeps an item whose saved last differs from at_write changed when this read is unchecked or has no result', () => {
  const unchecked = buildMockItem({ id: 't-a', check: 'pid:5', atWrite: 'alive', last: 'gone' });
  const leftOut = buildMockItem({ id: 't-b', check: 'pid:6', atWrite: 'alive', last: 'gone' });

  expect(
    pickChangedItems([unchecked, leftOut], new Map([['t-a', 'unchecked']])).map(
      (change) => change.item.id,
    ),
  ).toStrictEqual(['t-a', 't-b']);
});

test('it never picks an item with an at_write of dash, or one with no check', () => {
  const first = buildMockItem({ id: 't-a', check: 'pid:5', atWrite: null });
  const plain = buildMockItem({ id: 't-b', atWrite: 'alive', last: 'gone' });

  expect(pickChangedItems([first, plain], new Map([['t-a', 'gone']]))).toStrictEqual([]);
});

test('it lists the changed items in items order', () => {
  const items = ['t-c', 't-a', 't-b'].map((id) =>
    buildMockItem({ id, check: 'pid:5', atWrite: 'alive' }),
  );

  const changed = pickChangedItems(
    items,
    new Map([
      ['t-a', 'gone'],
      ['t-b', 'gone'],
      ['t-c', 'gone'],
    ]),
  );

  expect(changed.map((change) => change.item.id)).toStrictEqual(['t-c', 't-a', 't-b']);
});
