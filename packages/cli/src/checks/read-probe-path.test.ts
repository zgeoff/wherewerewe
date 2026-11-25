import { expect, test } from 'bun:test';
import { readProbePath } from './read-probe-path.ts';

function setupTest() {
  return { readProbePath };
}

test.each([
  { title: 'an absolute entry outside the folder', path: '/usr/bin', expected: '/usr/bin' },
  { title: 'an empty entry', path: ':/usr/bin:', expected: '/usr/bin' },
  { title: 'a relative entry', path: 'bin:./tools:../up:/usr/bin', expected: '/usr/bin' },
  { title: 'the folder itself', path: '/srv/work:/usr/bin', expected: '/usr/bin' },
  { title: 'a folder inside it', path: '/srv/work/node_modules/.bin:/bin', expected: '/bin' },
  {
    title: 'a path that leaves it again',
    path: '/srv/work/../tools',
    expected: '/srv/work/../tools',
  },
  {
    title: 'a sibling whose name starts like it',
    path: '/srv/work-2/bin',
    expected: '/srv/work-2/bin',
  },
  { title: 'a folder named like a parent step', path: '/srv/work/..bin', expected: '' },
])('it keeps only the absolute entries outside the working folder: $title', (row) => {
  const ctx = setupTest();

  expect(ctx.readProbePath(row.path, '/srv/work')).toBe(row.expected);
});
