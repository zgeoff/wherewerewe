import { expect, test } from 'bun:test';
import { buildReleaseTag } from './build-release-tag.ts';

function setupTest() {
  return { buildReleaseTag };
}

test('it names the tag of a version after the package', () => {
  const ctx = setupTest();

  expect(ctx.buildReleaseTag('0.2.0')).toBe('@wherewerewe/cli@0.2.0');
});
