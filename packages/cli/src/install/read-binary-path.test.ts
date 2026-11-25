import { expect, test } from 'bun:test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { readBinaryPath } from './read-binary-path.ts';

function setupTest() {
  const folder = createTempDir('read-binary-path').path;

  return { first: join(folder, 'first'), second: join(folder, 'second') };
}

test('it returns the first wherewerewe on PATH, as PATH names it', () => {
  const ctx = setupTest();

  mkdirSync(ctx.first);
  mkdirSync(ctx.second);
  writeFileSync(join(ctx.second, 'wherewerewe'), '');

  const found = readBinaryPath({ PATH: `${ctx.first}:${ctx.second}` }, '/opt/cellar/wherewerewe');

  expect(found).toBe(join(ctx.second, 'wherewerewe'));
});

test('it falls back to the running binary, and to the bare name when run from source', () => {
  const ctx = setupTest();

  expect({
    compiled: readBinaryPath({ PATH: ctx.first }, '/opt/cellar/wherewerewe'),
    source: readBinaryPath({ PATH: ctx.first }, '/usr/bin/bun'),
  }).toStrictEqual({ compiled: '/opt/cellar/wherewerewe', source: 'wherewerewe' });
});
