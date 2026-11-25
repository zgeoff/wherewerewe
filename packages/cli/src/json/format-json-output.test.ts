import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import fc from 'fast-check';
import { redactCredentialWords } from '../rules/redact-credential-words.ts';
import { runCLI } from '../run-cli.ts';
import { formatSessionFile } from '../store/format-session-file.ts';
import { buildCredentialFieldArbitrary } from '../test-utils/build-credential-field-arbitrary.ts';
import { buildCredentialSamples } from '../test-utils/build-credential-samples.ts';
import { buildJsonRedactionCases } from '../test-utils/build-json-redaction-cases.ts';
import { buildStoredTextArbitrary } from '../test-utils/build-stored-text-arbitrary.ts';
import { collectStringLeaves } from '../test-utils/collect-string-leaves.ts';
import { getJsonValue } from '../test-utils/get-json-value.ts';
import { runJsonCellRead } from '../test-utils/run-json-cell-read.ts';
import { plainCells, seedJsonCellsStore } from '../test-utils/seed-json-cells-store.ts';
import { seedStoreFile } from '../test-utils/seed-store-file.ts';
import { formatJSONOutput } from './format-json-output.ts';

function setupTest() {
  const root = createTempDir('format-json-output').path;
  const sample = buildCredentialSamples()[0]?.sample ?? '';

  return {
    root,
    formatJSONOutput,
    sample,
    cases: buildJsonRedactionCases(),

    // the brief's estimate counts the tokens of its text, which holds the cell too
    withoutEstimate: (stdout: string) => stdout.replace(/"estimate":\d+/u, '"estimate":0'),

    // the plain read with each plain text of the cell as the JSON string the cell now prints
    expectStdout: (plainStdout: string, cell: string, printed: string) =>
      plainStdout
        .replaceAll(JSON.stringify(plainCells[cell]), () => JSON.stringify(printed))
        .replace(/"estimate":\d+/u, '"estimate":0'),
    readCells: (cells: Readonly<Record<string, string>>, argv: readonly string[]) =>
      runJsonCellRead(root, cells, argv),
  };
}

test('it prints one line of JSON that ends in a line break', () => {
  const ctx = setupTest();

  expect(ctx.formatJSONOutput({ version: 1, rows: [{ id: 'a', note: null, isOpen: true }] })).toBe(
    '{"version":1,"rows":[{"id":"a","note":null,"isOpen":true}]}\n',
  );
});

test.each([
  {
    title: 'a string',
    build: (sample: string) => `see ${sample} now`,
    expected: 'see <where the secret lives> now',
  },
  {
    title: 'the whole string',
    build: (sample: string) => sample,
    expected: '<where the secret lives>',
  },
])('it prints the placeholder for the word of $title that holds a credential', (row) => {
  const ctx = setupTest();
  const printed = ctx.formatJSONOutput({ rows: [{ text: row.build(ctx.sample) }] });

  expect(printed).toBe(`{"rows":[{"text":${JSON.stringify(row.expected)}}]}\n`);
});

test('it prints the placeholder for an object key that holds a credential', () => {
  const ctx = setupTest();
  const printed = ctx.formatJSONOutput({ [ctx.sample]: 'plain' });

  expect(printed).toBe('{"<where the secret lives>":"plain"}\n');
});

test('it prints the placeholder for a string inside an array inside an object', () => {
  const ctx = setupTest();
  const printed = ctx.formatJSONOutput({ list: [[ctx.sample]] });

  expect(printed).toBe('{"list":[["<where the secret lives>"]]}\n');
});

test('it prints JSON that parses for a string that ends in ops_ and a few characters', () => {
  const ctx = setupTest();
  const value = { claim: 'Check the cache ops_abcde', after: 'x' };

  expect(JSON.parse(ctx.formatJSONOutput(value))).toStrictEqual(value);
});

test.each(
  buildJsonRedactionCases().flatMap((found) =>
    found.reads.map((read) => ({ cell: found.cell, argv: read.argv, path: read.path })),
  ),
)('it prints the plain text of $cell at $path in the output of www $argv --json', async (row) => {
  const ctx = setupTest();

  const printed = await ctx.readCells({}, row.argv);

  expect({
    exitCode: printed.exitCode,
    value: getJsonValue(JSON.parse(printed.stdout), row.path),
  }).toStrictEqual({ exitCode: 0, value: plainCells[row.cell] });
});

test('it places each string field of each shape in the table, or leaves it out as an id, a time, a kind or a name', async () => {
  const ctx = setupTest();

  const argvs = [
    [],
    ['show'],
    ['show', 't-a'],
    ['show', 'l-a'],
    ['show', 'p-a'],
    ['show', 'w-b'],
    ['show', 'd-1'],
    ['show', 'w-a'],
    ['show', 'ok-a'],
    ['show', 'r-a'],
    ['show', 'wh-a'],
    ['log'],
    ...['tasks', 'waits', 'approvals', 'rules', 'where', 'lessons', 'promises', 'words'].map(
      (kind) => ['list', kind],
    ),
    ...['notes', 'decisions', 'prs'].map((kind) => ['list', kind]),
    ['recap'],
  ];

  const printed = await Promise.all(argvs.map((argv) => ctx.readCells({}, argv)));

  const leaves = printed.flatMap((read, index) =>
    collectStringLeaves(JSON.parse(read.stdout)).map(
      (leaf) => `${(argvs[index] ?? []).slice(0, 1).join('')}|${leaf}`,
    ),
  );

  const tabled = new Set(
    ctx.cases.flatMap((found) =>
      found.reads.map((read) => {
        const leaf = read.path.map((step) => (typeof step === 'number' ? '[]' : step)).join('.');

        return `${read.argv.slice(0, 1).join('')}|${leaf}`;
      }),
    ),
  );

  const grammar = new Set([
    'id',
    'kind',
    'by',
    'host',
    'written',
    'ts',
    'said',
    'since',
    'session',
    'op',
    'focus',
    'note',
    'last',
    'checkedNow',
    '[]',
  ]);

  const unplaced = leaves.filter((leaf) => {
    const [, path = ''] = leaf.split('|');
    const last = path.split('.').at(-1) ?? '';

    return !tabled.has(leaf) && !grammar.has(last);
  });

  expect([...new Set(unplaced)]).toStrictEqual([]);
});

test.each([
  { field: 'may', build: (sample: string) => ({ may: [sample], scope: 'in the app' }) },
  { field: 'not', build: (sample: string) => ({ not: [sample], scope: 'in the app' }) },
  { field: 'never', build: (sample: string) => ({ never: [sample], scope: 'in the app' }) },
  { field: 'scope', build: (sample: string) => ({ may: ['merge it'], scope: sample }) },
  { field: 'reading', build: (sample: string) => ({ may: ['merge it'], reading: sample }) },
  { field: 'where', build: (sample: string) => ({ may: ['merge it'], where: sample }) },
])(
  'it reads a session whose grant $field holds a credential as broken, and prints no JSON',
  async (row) => {
    const ctx = setupTest();

    const printed = await Promise.all(
      buildCredentialSamples().map(async (credential) => {
        const root = join(ctx.root, `grant-${credential.name}`);
        const folder = seedJsonCellsStore(root, {});

        seedStoreFile(
          folder,
          'session',
          formatSessionFile({
            format: '2',
            name: 'tide-alerts',
            goal: 'Ship it',
            grant: {
              may: [],
              not: [],
              never: [],
              scope: null,
              reading: 'covers it',
              where: 'chat',
              set: '2026-03-10T09:00:00Z',
              ...row.build(credential.sample),
            },
            started: '2026-03-02T08:04:11Z',
            now: null,
            nowNext: null,
            nowSet: null,
            lastWrite: null,
            lastNudge: null,
            importedFrom: null,
          }),
        );

        const result = await runCLI({
          argv: ['--json'],
          env: {
            HOME: root,
            XDG_STATE_HOME: root,
            CLAUDE_CODE_SESSION_ID: '',
            WHEREWEREWE_SESSION: 'tide-alerts',
          },
          cwd: '/work',
          terminal: { stdin: false, stdout: false },
          now: () => Date.parse('2026-03-10T11:43:00Z'),
        });

        return {
          exitCode: result.exitCode,
          stdout: result.stdout,
          leaked: `${result.stdout}${result.stderr}`.includes(credential.tail),
        };
      }),
    );

    expect(printed).toStrictEqual(printed.map(() => ({ exitCode: 3, stdout: '', leaked: false })));
  },
);

test('it leaves out a note row that holds a credential, and names notes.tsv on stderr', async () => {
  const ctx = setupTest();

  const printed = await Promise.all(
    buildCredentialSamples().map(async (credential) => {
      const read = await ctx.readCells({ note: credential.sample }, ['list', 'notes']);

      return {
        exitCode: read.exitCode,
        rows: getJsonValue(JSON.parse(read.stdout), ['rows']),
        names: read.stderr.includes('notes.tsv'),
        leaked: `${read.stdout}${read.stderr}`.includes(credential.tail),
      };
    }),
  );

  expect(printed).toStrictEqual(
    printed.map(() => ({ exitCode: 0, rows: [], names: true, leaked: false })),
  );
});

test.each(['brief', 'show', 'log', 'list', 'recap'] as const)(
  'it prints the placeholder for a credential at any place in any string field of %s',
  async (shape) => {
    const ctx = setupTest();

    await fc.assert(
      fc.asyncProperty(buildCredentialFieldArbitrary(ctx.cases, shape), async (generated) => {
        const plain = await ctx.readCells({}, generated.read.argv);

        const printed = await ctx.readCells(
          { [generated.cell]: generated.value },
          generated.read.argv,
        );

        const windows = Array.from({ length: generated.tail.length - 3 }, (_unused, index) =>
          generated.tail.slice(index, index + 4),
        );

        expect({
          exitCode: printed.exitCode,
          stdout: ctx.withoutEstimate(printed.stdout),
          leaked: windows.some((window) => `${printed.stdout}${printed.stderr}`.includes(window)),
        }).toStrictEqual({
          exitCode: 0,
          stdout: ctx.expectStdout(plain.stdout, generated.cell, generated.expected),
          leaked: false,
        });
      }),
    );
  },
);

test.each(['brief', 'show', 'log', 'list', 'recap'] as const)(
  'it prints JSON that parses for any stored text in any string field of %s',
  async (shape) => {
    const ctx = setupTest();

    await fc.assert(
      fc.asyncProperty(buildStoredTextArbitrary(ctx.cases, shape), async (generated) => {
        const plain = await ctx.readCells({}, generated.read.argv);

        const printed = await ctx.readCells(
          { [generated.cell]: generated.value },
          generated.read.argv,
        );

        const redacted = redactCredentialWords(generated.value);

        expect({
          exitCode: printed.exitCode,
          lines: printed.stdout.split('\n').length,
          stdout: ctx.withoutEstimate(printed.stdout),
        }).toStrictEqual({
          exitCode: 0,
          lines: 2,
          stdout: ctx.expectStdout(plain.stdout, generated.cell, redacted),
        });

        expect(() => JSON.parse(printed.stdout)).not.toThrow();
      }),
    );
  },
);

test.each([
  {
    title: 'a claim that ends in ops_ and five characters',
    cells: { 'task claim': 'Check the cache ops_abcde' },
    argv: ['list', 'tasks'],
    path: ['rows', 0, 'row', 'claim'],
    expected: 'Check the cache ops_abcde',
  },
  {
    title: 'an item id that holds a credential, in the list of tasks, with its note left out',
    cells: { 'task id': buildCredentialSamples()[0]?.sample.slice(0, 16) ?? '' },
    argv: ['list', 'tasks'],
    path: ['rows', 0, 'row', 'id'],
    expected: '<where the secret lives>',
  },
  {
    title: 'the focus of a session whose item id holds a credential',
    cells: { 'task id': buildCredentialSamples()[0]?.sample.slice(0, 16) ?? '' },
    argv: [],
    path: ['focus'],
    expected: '<where the secret lives>',
  },
  {
    title: 'a session name that holds a credential, in the brief',
    cells: { 'session name': ['sk', '-', 'abcdefghijklmnopqrstu'].join('') },
    argv: [],
    path: ['session'],
    expected: '<where the secret lives>',
  },
  {
    title: 'a session name that holds a credential, in the recap',
    cells: { 'session name': ['sk', '-', 'abcdefghijklmnopqrstu'].join('') },
    argv: ['recap'],
    path: ['session'],
    expected: '<where the secret lives>',
  },
  ...[
    { cell: 'task claim', id: 't-a', field: 'claim' },
    { cell: 'wait claim', id: 'w-a', field: 'claim' },
    { cell: 'approval quote', id: 'ok-a', field: 'claim' },
    { cell: 'rule claim', id: 'r-a', field: 'claim' },
    { cell: 'where claim', id: 'wh-a', field: 'claim' },
    { cell: 'lesson text', id: 'l-a', field: 'text' },
    { cell: 'promise what', id: 'p-a', field: 'what' },
    { cell: 'words', id: 'w-b', field: 'words' },
    { cell: 'decision choice', id: 'd-1', field: 'text' },
  ].map((member) => ({
    title: `the first string field of the show subject ${member.id}`,
    cells: { [member.cell]: buildCredentialSamples()[0]?.sample ?? '' },
    argv: ['show', member.id],
    path: ['subjects', 0, 'row', member.field],
    expected: '<where the secret lives>',
  })),
])('it prints $title as the JSON value $expected', async (row) => {
  const ctx = setupTest();

  const printed = await ctx.readCells(row.cells, row.argv);

  expect({
    exitCode: printed.exitCode,
    value: getJsonValue(JSON.parse(printed.stdout), row.path),
  }).toStrictEqual({ exitCode: 0, value: row.expected });
});
