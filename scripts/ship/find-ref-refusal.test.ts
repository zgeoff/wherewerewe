import { expect, test } from 'bun:test';
import { findRefRefusal } from './find-ref-refusal.ts';

function setupTest() {
  return { findRefRefusal };
}

test('it allows a run at the tag of the version', () => {
  const ctx = setupTest();

  expect(ctx.findRefRefusal('refs/tags/@wherewerewe/cli@0.2.0', '0.2.0')).toBeNull();
});

test.each([
  ['a branch', 'refs/heads/main'],
  ['another version', 'refs/tags/@wherewerewe/cli@0.1.0'],
  ['another package', 'refs/tags/@wherewerewe/other@0.2.0'],
  ['a pull request', 'refs/pull/7/merge'],
  ['an empty ref', ''],
])('it refuses a run at %s', (_title, ref) => {
  const ctx = setupTest();

  expect(ctx.findRefRefusal(ref, '0.2.0')).toBe(
    `the run is at ${ref}, and a ship runs only at refs/tags/@wherewerewe/cli@0.2.0`,
  );
});

test('it refuses a run that has no ref', () => {
  const ctx = setupTest();

  expect(ctx.findRefRefusal(undefined, '0.2.0')).toBe(
    'the run is at no ref, and a ship runs only at refs/tags/@wherewerewe/cli@0.2.0',
  );
});
