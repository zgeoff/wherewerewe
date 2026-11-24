import { expect, test } from 'bun:test';
import { checkPathName } from './check-path-name.ts';

test.each(['a', 'dock-map', '0-9', 'a'.repeat(32)])('it accepts the name %s', (name) => {
  expect(() => {
    checkPathName(name);
  }).not.toThrow();
});

test.each(['', 'a'.repeat(33), 'Dock', 'a/b', '..', 'a b', 'a_b'])(
  'it refuses the name %p',
  (name) => {
    expect(() => {
      checkPathName(name);
    }).toThrow('must be 1 to 32 characters');
  },
);
