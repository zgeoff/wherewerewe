import { expect, test } from 'bun:test';
import { redactJoinedCredentials } from './redact-joined-credentials.ts';

function setupTest() {
  return { redactJoinedCredentials };
}

test.each([
  ['no credential', 'lint\tand\ttest', 'lint\tand\ttest'],
  [
    'a credential that a joiner splits',
    `use ${['gh', '\t', 'p_', 'abc'].join('')}, then wait`,
    'use <where the secret lives>, then wait',
  ],
  [
    'a credential that a joiner splits after a character outside the basic plane',
    `🚀 ${['xo', '\t', 'xb-', '12'].join('')} done`,
    '🚀 <where the secret lives> done',
  ],
  [
    'a credential whose body a joiner splits',
    `${['ghp_', 'Qz7', '\t', 'Wx9'].join('')} done`,
    '<where the secret lives> done',
  ],
])('it redacts on the raw text for %s', (_title, text, expected) => {
  const ctx = setupTest();

  expect(ctx.redactJoinedCredentials(text, /\t/u)).toBe(expected);
});

test('it leaves a credential that a character outside the joiner splits to the word redaction', () => {
  const ctx = setupTest();

  expect(ctx.redactJoinedCredentials(['gh', ' ', 'p_abc'].join(''), /\t/u)).toBe('gh p_abc');
});
