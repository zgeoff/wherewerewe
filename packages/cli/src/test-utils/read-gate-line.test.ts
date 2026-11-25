import { expect, test } from 'bun:test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { readGateLine } from './read-gate-line.ts';

function setupTest() {
  return { root: createTempDir('read-gate-line').path };
}

test('it returns the gate file line without its line break', () => {
  const ctx = setupTest();

  mkdirSync(join(ctx.root, '.gate'));

  writeFileSync(
    join(ctx.root, '.gate', 'claude-9e1f-trial'),
    'state=read session=tide-alerts reads=0 spare=1\n',
  );

  expect(readGateLine(ctx.root, 'claude-9e1f-trial')).toBe(
    'state=read session=tide-alerts reads=0 spare=1',
  );
});

test('it returns null when the agent session has no gate file', () => {
  const ctx = setupTest();

  expect(readGateLine(ctx.root, 'claude-9e1f-trial')).toBeNull();
});
