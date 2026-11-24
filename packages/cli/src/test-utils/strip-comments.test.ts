import { expect, test } from 'bun:test';
import { stripComments } from './strip-comments.ts';

test('it cuts block and line comments and keeps a URL in a string', () => {
  const source = "a(); // x\n/* y\n z */ b('https://example.test/p');\n// w\n";

  expect(stripComments(source)).toStrictEqual('a();\nb("https://example.test/p");\n');
});

test('it cuts a line comment that follows a regex holding a quote', () => {
  const source = "const possessive = /it's/u; // the agent's CODEX_THREAD_ID\n";

  expect(stripComments(source)).toStrictEqual("const possessive = /it's/u;\n");
});

test('it keeps comment markers inside strings, template literals and a regex class', () => {
  const source = `const a = "//x"; const b = \`/* \${\`//\`} */\`; const c = /[//]+/gu; // z\n`;

  expect(stripComments(source)).toStrictEqual(
    `const a = "//x";\nconst b = \`/* \${\`//\`} */\`;\nconst c = /[//]+/gu;\n`,
  );
});

test('it cuts a type annotation and keeps the value', () => {
  const source = 'const env: { CODEX_THREAD_ID: string } = { CODEX_SESSION_ID: "" };\n';

  expect(stripComments(source)).toStrictEqual('const env = { CODEX_SESSION_ID: "" };\n');
});
