import { expect, test } from 'bun:test';
import { stripComments } from './strip-comments.ts';

test('it cuts block and line comments and keeps a URL in a string', () => {
  const source = "a(); // x\n/* y\n z */ b('https://example.test/p');\n// w\n";

  expect(stripComments(source)).toStrictEqual("a(); \n b('https://example.test/p');\n\n");
});
