import { expect, test } from 'bun:test';
import { findCredentialMatch } from '../rules/find-credential-match.ts';
import { buildNamedCredentialCells } from './build-named-credential-cells.ts';

function setupTest() {
  return { buildNamedCredentialCells };
}

test.each(buildNamedCredentialCells())(
  'it gives $cell a value that the credential test matches and that holds its tail',
  (row) => {
    const ctx = setupTest();
    const found = ctx.buildNamedCredentialCells().find((entry) => entry.cell === row.cell);

    expect({
      isMatch: findCredentialMatch(found?.value ?? '') !== null,
      hasTail: (found?.tail.length ?? 0) >= 4 && (found?.value ?? '').includes(found?.tail ?? '-'),
    }).toStrictEqual({ isMatch: true, hasTail: true });
  },
);
