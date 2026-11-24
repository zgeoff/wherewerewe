import { expect, test } from 'bun:test';
import { collectUsageVariants } from './collect-usage-variants.ts';

test('it gives the required words alone, then each optional group and each choice in turn', () => {
  const variants = collectUsageVariants(
    'set <id> ["<claim>"] [<check>] [--note "<detail>" [--owed] | --no-note]',
  );

  expect(variants).toStrictEqual([
    ['set', { placeholder: '<id>', shape: 'id' }],
    ['set', { placeholder: '<id>', shape: 'id' }, { placeholder: '<claim>' }],
    ['set', { placeholder: '<id>', shape: 'id' }, '--pr', 'acme/tool#1'],
    ['set', { placeholder: '<id>', shape: 'id' }, '--note', { placeholder: '<detail>' }, '--owed'],
    ['set', { placeholder: '<id>', shape: 'id' }, '--no-note'],
  ]);
});

test('it gives only the required words for a line with no group', () => {
  expect(collectUsageVariants('ack o-<n>')).toStrictEqual([['ack', 'o-1']]);
});

test('it keeps a bare optional flag of log as a variant', () => {
  expect(collectUsageVariants('log [--bogus]')).toStrictEqual([['log'], ['log', '--bogus']]);
});
