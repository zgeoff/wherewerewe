import { expect, test } from 'bun:test';
import { findStoreRoot } from './find-store-root.ts';

test.each([
  [{ XDG_STATE_HOME: '/state', HOME: '/home/sam' }, '/state/wherewerewe'],
  [{ XDG_STATE_HOME: '', HOME: '/home/sam' }, '/home/sam/.local/state/wherewerewe'],
  [{ HOME: '/home/sam' }, '/home/sam/.local/state/wherewerewe'],
  [{ XDG_STATE_HOME: '', HOME: '' }, null],
  [{}, null],
])('it finds the root for %p as %p', (env, expected) => {
  expect(findStoreRoot(env)).toBe(expected);
});
