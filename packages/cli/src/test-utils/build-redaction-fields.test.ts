import { expect, test } from 'bun:test';
import { findCredentialMatch } from '../rules/find-credential-match.ts';
import { buildRedactionFields, buildRedactionValues } from './build-redaction-fields.ts';

function setupTest() {
  return { fields: buildRedactionFields(), build: buildRedactionValues };
}

test('it leaves out the fields of 16 characters, which no credential fits', () => {
  const ctx = setupTest();

  expect(ctx.fields.map((field) => field.name)).toStrictEqual([
    'lesson text',
    'lesson why',
    'promise what',
    'promise by',
    'words',
    'decision choice',
    'decision why',
  ]);
});

test.each([0, 1, 2, 3, 7, 19])(
  'it builds a credential of its own for each field at offset %p, within the field and its separators',
  (offset) => {
    const ctx = setupTest();
    const values = ctx.build(ctx.fields, offset);

    expect({
      matched: ctx.fields.map(
        (field) => findCredentialMatch(values.credentials[field.name] ?? '') !== null,
      ),
      fits: ctx.fields.map(
        (field) =>
          (values.credentials[field.name] ?? '').length <= field.limit &&
          (values.placedPlaceholders[field.name] ?? '').length <= field.limit,
      ),
      separated: ctx.fields
        .filter((field) => field.isSeparated)
        .filter((field) => /[;=]/u.test(values.credentials[field.name] ?? '')),
      distinctTails: new Set(values.tails).size,
    }).toStrictEqual({
      matched: ctx.fields.map(() => true),
      fits: ctx.fields.map(() => true),
      separated: [],
      distinctTails: ctx.fields.length,
    });
  },
);
