import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { collectTypeFields } from '../test-utils/collect-type-fields.ts';
import { readDesignBlock } from '../test-utils/read-design-block.ts';

function setupTest() {
  return {
    collectTypeFields,
    readDocTypes: () => readDesignBlock('lists-and-json.md', '### --json', 'ts'),
    readCodeTypes: () => readFileSync(join(import.meta.dir, 'types.ts'), 'utf8'),
  };
}

test('it names the same fields in lists-and-json.md as in json/types.ts', () => {
  const ctx = setupTest();
  const doc = ctx.collectTypeFields(ctx.readDocTypes());
  const code = ctx.collectTypeFields(ctx.readCodeTypes());

  const names = [
    'Shown',
    'BriefJson',
    'ShowSubject',
    'ShowJson',
    'LogJson',
    'ListJson',
    'RecapJson',
  ];

  expect(Object.fromEntries(names.map((name) => [name, code[name]]))).toStrictEqual(
    Object.fromEntries(names.map((name) => [name, doc[name]])),
  );
});
