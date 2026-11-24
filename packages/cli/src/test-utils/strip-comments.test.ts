import { expect, test } from 'bun:test';
import { stripComments } from './strip-comments.ts';

test('it cuts block and line comments and keeps a URL in a string', () => {
  const source = "a(); // x\n/* y\n z */ b('https://example.test/p');\n// w\n";

  expect(stripComments(source)).toStrictEqual("a(); \n b('https://example.test/p');\n\n");
});

test('it cuts a line comment that follows code with no space', () => {
  const source = "resolveProgram('www');// CODEX_THREAD_ID\nconst a = 1;//x\n";

  expect(stripComments(source)).toStrictEqual("resolveProgram('www');\nconst a = 1;\n");
});

test('it keeps comment markers inside string literals', () => {
  const source = 'const a = "//x"; const b = `/* y */`; // z\n';

  expect(stripComments(source)).toStrictEqual('const a = "//x"; const b = `/* y */`; \n');
});
