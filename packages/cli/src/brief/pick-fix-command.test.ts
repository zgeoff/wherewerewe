import { expect, test } from 'bun:test';
import { buildMockItem } from '../test-utils/build-mock-item.ts';
import { pickFixCommand } from './pick-fix-command.ts';

test.each([
  ['pr:acme/tool#7', 'MERGED', 'www done t-a --evidence "merged, seen by check"'],
  ['pr:acme/tool#7', 'CLOSED', 'www drop t-a --why "closed unmerged, seen by check"'],
  ['pid:42', 'gone', 'www drop t-a --why "process gone, seen by check"'],
  ['branch:/srv/app@fix', 'gone', 'www drop t-a --why "branch gone, seen by check"'],
  ['path:/srv/app', 'missing', 'www drop t-a --why "path missing, seen by check"'],
  ['pr:acme/tool#7', 'OPEN failing', 'www set t-a "<what is true now>"'],
  ['path:/srv/app', 'dirty', 'www set t-a "<what is true now>"'],
])('it picks the fix for %s reading %s', (check, result, expected) => {
  expect(pickFixCommand(buildMockItem({ id: 't-a', check }), result)).toBe(expected);
});
