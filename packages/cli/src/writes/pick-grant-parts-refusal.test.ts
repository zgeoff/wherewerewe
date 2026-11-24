import { expect, test } from 'bun:test';
import { buildParsedArgs } from '../test-utils/build-parsed-args.ts';
import { pickGrantPartsRefusal } from './pick-grant-parts-refusal.ts';

test.each([
  {
    title: '--not alone with where and reading',
    argv: ['--not', 'x', '--where', 'c', '--reading', 'r'],
    isAlone: false,
    kind: null,
  },
  {
    title: '--never alone with where and reading',
    argv: ['--never', 'x', '--where', 'c', '--reading', 'r'],
    isAlone: false,
    kind: null,
  },
  {
    title: '--not and --never with where and reading',
    argv: ['--not', 'x', '--never', 'y', '--where', 'c', '--reading', 'r'],
    isAlone: false,
    kind: null,
  },
  {
    title: '--may with where and reading',
    argv: ['--may', 'x', '--where', 'c', '--reading', 'r'],
    isAlone: false,
    kind: null,
  },
  {
    title: '--scope, --where and --reading with no bullet',
    argv: ['--scope', 's', '--where', 'c', '--reading', 'r'],
    isAlone: false,
    kind: 'grant-needs-part',
  },
  {
    title: '--not with no where and no reading',
    argv: ['--not', 'x'],
    isAlone: false,
    kind: 'grant-needs-part',
  },
  {
    title: '--reading alone where it is allowed',
    argv: ['--reading', 'r'],
    isAlone: true,
    kind: null,
  },
  {
    title: '--reading alone where it is not allowed',
    argv: ['--reading', 'r'],
    isAlone: false,
    kind: 'grant-needs-part',
  },
])('it gives $kind for $title', (row) => {
  const picked = pickGrantPartsRefusal(buildParsedArgs(['grant', ...row.argv]), row.isAlone);

  expect(picked?.kind ?? null).toBe(row.kind);
});
