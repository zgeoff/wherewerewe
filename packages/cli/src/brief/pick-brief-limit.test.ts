import { expect, test } from 'bun:test';
import { pickBriefLimit } from './pick-brief-limit.ts';

test.each([
  { host: 'claude', bytes: 24_000, tokens: 8000 },
  { host: 'codex', bytes: 30_000, tokens: 10_000 },
  { host: null, bytes: 60_000, tokens: 20_000 },
] as const)('it gives $bytes bytes and $tokens tokens for host $host', (row) => {
  expect(pickBriefLimit(row.host)).toStrictEqual({ bytes: row.bytes, tokens: row.tokens });
});
