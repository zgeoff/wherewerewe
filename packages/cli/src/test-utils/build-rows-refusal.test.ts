import { expect, test } from 'bun:test';
import { buildRowsRefusal } from './build-rows-refusal.ts';

test('it counts the problems in the first line and runs the import again', () => {
  expect(buildRowsRefusal(['items.tsv line 2: a', 'items.tsv line 3: b'])).toStrictEqual({
    kind: 'refused',
    refusal: {
      exitCode: 3,
      lines: [
        'www: refused: import found 2 rows that break the rules, and wrote nothing.',
        'items.tsv line 2: a',
        'items.tsv line 3: b',
      ],
      runs: [{ www: ['import', 'old-notes'] }],
    },
  });
});
