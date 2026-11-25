import { expect, test } from 'bun:test';
import { formatChecksums } from './format-checksums.ts';

function setupTest() {
  return { formatChecksums };
}

test('it formats checksums as shasum does: hash, two spaces, name, in name order', () => {
  const ctx = setupTest();

  expect(
    ctx.formatChecksums([
      { name: 'wherewerewe-linux-x64', sha256: 'bb' },
      { name: 'wherewerewe-darwin-arm64', sha256: 'aa' },
    ]),
  ).toBe('aa  wherewerewe-darwin-arm64\nbb  wherewerewe-linux-x64\n');
});
