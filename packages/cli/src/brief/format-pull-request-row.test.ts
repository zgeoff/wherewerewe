import { expect, test } from 'bun:test';
import { buildCredentialSamples } from '../test-utils/build-credential-samples.ts';
import { briefRefCharacters, formatPullRequestRow } from './format-pull-request-row.ts';

function setupTest() {
  const nowMs = Date.parse('2026-03-10T11:43:00Z');

  return {
    format: (ref: string, maxRefCharacters: number) =>
      formatPullRequestRow(
        { ref, opened: '2026-03-10T08:43:00Z', result: 'OPEN pending' },
        nowMs,
        maxRefCharacters,
      ),
  };
}

test.each([
  {
    title: 'a short ref',
    ref: 'acme/tool#64',
    line: '  acme/tool#64  opened 3h ago  [OPEN pending]',
  },
  {
    title: 'a ref of 61 characters',
    ref: `${'p'.repeat(61)}`,
    line: `  ${'p'.repeat(59)}…  opened 3h ago  [OPEN pending]`,
  },
])('it formats $title for the brief', (row) => {
  const ctx = setupTest();

  expect(ctx.format(row.ref, briefRefCharacters)).toBe(row.line);
});

test('it prints a ref of 90 characters whole when it takes no cut', () => {
  const ctx = setupTest();
  const ref = `acme/${'p'.repeat(80)}#64`;

  expect(ctx.format(ref, Number.POSITIVE_INFINITY)).toBe(`  ${ref}  opened 3h ago  [OPEN pending]`);
});

test.each(buildCredentialSamples().map((entry) => [entry.name, entry.sample] as const))(
  'it prints the placeholder for a %s credential that sits past column 60 of a ref, whatever the cut',
  (_name, sample) => {
    const ctx = setupTest();
    const ref = `acme/${'p'.repeat(54)}${sample}`;

    expect([
      ctx.format(ref, briefRefCharacters),
      ctx.format(ref, Number.POSITIVE_INFINITY),
    ]).toStrictEqual([
      '  <where the secret lives>  opened 3h ago  [OPEN pending]',
      '  <where the secret lives>  opened 3h ago  [OPEN pending]',
    ]);
  },
);
