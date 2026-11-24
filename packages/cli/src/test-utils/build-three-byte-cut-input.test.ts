import { expect, test } from 'bun:test';
import { cutRanks } from '../brief/cut-ranks.ts';
import { buildThreeByteCutInput } from './build-three-byte-cut-input.ts';
import { threeByteRanks } from './three-byte-ranks.ts';
import { threeByteSections } from './three-byte-sections.ts';

function setupTest() {
  return {
    buildThreeByteCutInput,
    ranks: Object.keys(threeByteRanks),
    sections: Object.keys(threeByteSections),
  };
}

test('it names a prefix and a section for every rank of the cut order', () => {
  const ctx = setupTest();

  expect([ctx.ranks, ctx.sections]).toStrictEqual([[...cutRanks], [...cutRanks]]);
});

test('it builds the same input on each call', () => {
  const ctx = setupTest();

  expect(ctx.buildThreeByteCutInput('claude')).toStrictEqual(ctx.buildThreeByteCutInput('claude'));
});
