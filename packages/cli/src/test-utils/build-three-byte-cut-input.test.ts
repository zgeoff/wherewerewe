import { expect, test } from 'bun:test';
import { cutRanks } from '../brief/cut-ranks.ts';
import { buildThreeByteCutInput } from './build-three-byte-cut-input.ts';
import { threeByteRanks } from './three-byte-ranks.ts';
import { threeByteSections } from './three-byte-sections.ts';

test('it names a prefix and a section for every rank of the cut order', () => {
  expect([Object.keys(threeByteRanks), Object.keys(threeByteSections)]).toStrictEqual([
    [...cutRanks],
    [...cutRanks],
  ]);
});

test('it builds the same input on each call', () => {
  expect(buildThreeByteCutInput('claude')).toStrictEqual(buildThreeByteCutInput('claude'));
});
