import { expect, test } from 'bun:test';
import { parseSessionFile } from '../store/parse-session-file.ts';
import { buildSessionLines } from './build-session-lines.ts';

test('it builds lines that parse as a format 2 session with no grant', () => {
  const parsed = parseSessionFile(`${buildSessionLines().join('\n')}\n`);
  const grant = parsed.kind === 'session' ? parsed.session.grant : parsed;

  expect(grant).toBeNull();
});
