import { expect, test } from 'bun:test';
import { chmodSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { readDoctorText } from './read-doctor-text.ts';

function setupTest() {
  return { folder: createTempDir('read-doctor-text').path };
}

test('it reads a file, and treats a missing file and an unreadable file as no text', () => {
  const ctx = setupTest();
  const readable = join(ctx.folder, 'a.json');
  const sealed = join(ctx.folder, 'b.json');

  writeFileSync(readable, '{}');
  writeFileSync(sealed, '{}');
  chmodSync(sealed, 0o000);

  expect([
    readDoctorText(readable),
    readDoctorText(sealed),
    readDoctorText(join(ctx.folder, 'none.json')),
  ]).toStrictEqual(['{}', null, null]);
});
