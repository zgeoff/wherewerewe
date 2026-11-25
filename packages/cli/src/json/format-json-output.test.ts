import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import fc from 'fast-check';
import { keyKinds } from '../import/collect-item-checks.ts';
import type { ListKind } from '../rules/list-kinds.ts';
import { redactCredentialWords } from '../rules/redact-credential-words.ts';
import { runCLI } from '../run-cli.ts';
import { formatSessionFile } from '../store/format-session-file.ts';
import { buildCredentialFieldArbitrary } from '../test-utils/build-credential-field-arbitrary.ts';
import { buildCredentialSamples } from '../test-utils/build-credential-samples.ts';
import { buildJsonCellArgvs } from '../test-utils/build-json-cell-argvs.ts';
import { buildJsonRedactionCases } from '../test-utils/build-json-redaction-cases.ts';
import { buildNamedCredentialCells } from '../test-utils/build-named-credential-cells.ts';
import { buildStoredTextArbitrary } from '../test-utils/build-stored-text-arbitrary.ts';
import {
  collectSchemaFieldPaths,
  collectValueFieldPaths,
} from '../test-utils/collect-schema-field-paths.ts';
import { collectSchemaStringPaths } from '../test-utils/collect-schema-string-paths.ts';
import { collectStringLeaves } from '../test-utils/collect-string-leaves.ts';
import { getJsonValue } from '../test-utils/get-json-value.ts';
import { jsonSchemas } from '../test-utils/json-schemas.ts';
import { runJsonCellRead } from '../test-utils/run-json-cell-read.ts';
import { plainCells, seedJsonCellsStore } from '../test-utils/seed-json-cells-store.ts';
import { seedStoreFile } from '../test-utils/seed-store-file.ts';
import type { FileKind } from '../types.ts';
import { formatJSONOutput } from './format-json-output.ts';
import type { Shown } from './types.ts';

function setupTest() {
  const root = createTempDir('format-json-output').path;
  const sample = buildCredentialSamples()[0]?.sample ?? '';

  return {
    root,
    formatJSONOutput,
    sample,
    cases: buildJsonRedactionCases(),
    argvs: buildJsonCellArgvs(),
    schemaPaths: (['brief', 'show', 'log', 'list', 'recap'] as const).flatMap((shape) =>
      collectSchemaStringPaths(jsonSchemas[shape]).map((path) => `${shape}|${path}`),
    ),
    fieldPaths: (['brief', 'show', 'log', 'list', 'recap'] as const).flatMap((shape) =>
      collectSchemaFieldPaths(jsonSchemas[shape]).map((path) => `${shape}|${path}`),
    ),

    named: buildNamedCredentialCells(),

    // the brief's estimate counts the tokens of its text, which holds the cell too
    withoutEstimate: (stdout: string) => stdout.replace(/"estimate":\d+/u, '"estimate":0'),

    // the plain read with each plain text of the cell as the JSON string the cell now prints
    expectStdout: (plainStdout: string, cell: string, shownText: string) =>
      plainStdout
        .replaceAll(JSON.stringify(plainCells[cell]), () => JSON.stringify(shownText))
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

test('it prints the plain text of each cell only at the places the table names, so a property can swap it', async () => {
  const ctx = setupTest();

  const reads = ctx.cases.flatMap((found) =>
    found.reads
      .filter(
        (read, at) =>
          found.reads.findIndex((other) => other.argv.join(' ') === read.argv.join(' ')) === at,
      )
      .map((read) => ({
        cell: found.cell,
        argv: read.argv,
        places: found.reads.filter((other) => other.argv.join(' ') === read.argv.join(' ')).length,
      })),
  );

  const printed = await Promise.all(
    reads.map(async (read) => {
      const result = await ctx.readCells({}, read.argv);

      const places = result.stdout.split(JSON.stringify(plainCells[read.cell])).length - 1;

      return { ...read, places };
    }),
  );

  expect(printed).toStrictEqual(reads);
});

test('it prints a value at every field of every kind of row in every shape, and a row of every list kind, from the seeded store', async () => {
  const ctx = setupTest();

  const printed = await Promise.all(
    ctx.argvs.map(async (read) => {
      const result = await ctx.readCells({}, read.argv);

      const value: unknown = JSON.parse(result.stdout);

      return { read, value };
    }),
  );

  const observed = new Set(
    printed.flatMap((entry) =>
      collectValueFieldPaths(jsonSchemas[entry.read.shape], entry.value).map(
        (path) => `${entry.read.shape}|${path}`,
      ),
    ),
  );

  const fileKinds: readonly string[] = ['lesson', 'promise', 'words'] satisfies FileKind[];

  const listRowKinds: ReadonlyMap<string, string> = new Map(
    Object.entries({
      tasks: 'task',
      waits: 'wait',
      approvals: 'ok',
      rules: 'rule',
      where: 'where',
      lessons: 'lesson',
      promises: 'promise',
      words: 'words',
    } satisfies Record<Exclude<ListKind, 'notes' | 'decisions' | 'prs'>, Shown['kind']>),
  );

  const unprintable = new Set(
    ctx.fieldPaths.filter((path) => {
      const extra = /\{kind=(?<kind>\w+)\}\.row\.extra\.(?<key>\w+)$/u.exec(path)?.groups;

      const listed = /^list\|\{kind=(?<list>\w+)\}\.rows\.\[\]\{kind=(?<kind>\w+)\}/u.exec(
        path,
      )?.groups;

      const held = /^(?:brief\|open\.\[\]|recap\|notes\.\[\]\.item)\{kind=(?<kind>\w+)\}/u.exec(
        path,
      )?.groups;

      const subject = /^show\|subjects\.\[\]\{kind=(?<kind>\w+)\}\.(?<field>.+)$/u.exec(
        path,
      )?.groups;

      const subjectKind = subject?.['kind'] ?? '';

      return [
        // a write and the import each keep an extra key only on the kinds keyKinds names for it
        keyKinds.some(
          (entry) =>
            entry.key === extra?.['key'] && !entry.kinds.some((kind) => kind === extra['kind']),
        ),

        // a rule refuses a check, and only a pid: check stores a pid_start
        /\{kind=rule\}\.(?:row\.check|row\.extra\.pid_start|checkedNow)$/u.test(path),

        // a list of one kind holds rows of that kind only
        listed !== undefined && listRowKinds.get(listed['list'] ?? '') !== listed['kind'],

        // the brief's open items and the recap's notes hold items.tsv rows only
        fileKinds.includes(held?.['kind'] ?? ''),

        // a lesson, a promise or the owner's words has no check to probe
        fileKinds.includes(subjectKind) && subject?.['field'] === 'checkedNow',

        // a decision's --on names an items.tsv id or a closed one, never a file row's
        fileKinds.includes(subjectKind) && subject?.['field'] === 'decisions.[]',

        // gh gives a failing check its name, as run-show-command.test.ts shows
        path.endsWith('.failingChecks.[]'),

        // only a close, a decision, a lesson or a grant row has a why, and a closed id never opens
        // again, so no other subject's own rows hold one
        subject?.['field'] === 'journal.[].why' &&
          !['lesson', 'grant', 'decision'].includes(subjectKind),

        // a lesson's row has no extra, and a drop closes it for good
        subjectKind === 'lesson' && subject?.['field'] === 'journal.[].extra',
      ].includes(true);
    }),
  );

  expect({
    missing: ctx.fieldPaths.filter((path) => !observed.has(path) && !unprintable.has(path)),
    printedAnyway: [...unprintable].filter((path) => observed.has(path)),
    emptyLists: printed
      .filter((entry) => entry.read.shape === 'list')
      .filter((entry) => JSON.stringify(getJsonValue(entry.value, ['rows'])) === '[]')
      .map((entry) => entry.read.argv[1]),
  }).toStrictEqual({ missing: [], printedAnyway: [], emptyLists: [] });
});

test('it places every string field of every shape in the table, a named row or a class of its own', async () => {
  const ctx = setupTest();

  const tabled = ctx.cases.flatMap((found) =>
    found.reads.map(
      (read) =>
        `${read.shape}|${read.path.map((step) => (typeof step === 'number' ? '[]' : step)).join('.')}`,
    ),
  );

  const plain = await Promise.all(
    ctx.argvs.map(async (read) => {
      const result = await ctx.readCells({}, read.argv);

      const value: unknown = JSON.parse(result.stdout);

      return { read, value };
    }),
  );

  const named = plain.flatMap((entry) =>
    collectStringLeaves(entry.value, [], (text) =>
      ctx.named.some((found) => plainCells[found.cell] === text),
    ).map((leaf) => `${entry.read.shape}|${leaf}`),
  );

  // a field that no store text reaches as written, or whose text has a test of its own below
  const ownClasses = [
    {
      reason: 'a parser refuses a credential in a grant text or a note, as the rows below show',
      paths: [
        ...['brief', 'recap'].flatMap((shape) =>
          ['may.[]', 'not.[]', 'never.[]', 'scope', 'where', 'reading'].map(
            (field) => `${shape}|grant.${field}`,
          ),
        ),
        ...['may.[]', 'not.[]', 'never.[]', 'scope', 'reading'].map(
          (field) => `show|subjects.[].row.${field}`,
        ),
        'brief|open.[].note.note',
        'show|subjects.[].note.note',
        'list|rows.[].note',
        'list|rows.[].note.note',
        'recap|notes.[].item.note.note',
        'recap|notes.[].note.note',
      ],
    },
    {
      reason: 'a parser refuses any text that is not an ISO 8601 time, or the tool writes it',
      paths: [
        'brief|ownerNotes.[].said',
        ...['words', 'lessons', 'promises'].map((kind) => `brief|${kind}.[].written`),
        'brief|open.[].note.written',
        'brief|prs.[].opened',
        'brief|prs.[].seen',
        'show|subjects.[].note.written',
        'list|rows.[].written',
        'list|rows.[].note.written',
        'list|rows.[].opened',
        'list|rows.[].seen',
        'recap|since',
        'recap|promises.[].written',
        'recap|notes.[].item.note.written',
        'recap|notes.[].note.written',
      ],
    },
    {
      reason: 'the recap keeps a journal row only when its ts is a time after since',
      paths: ['recap|decidedSince.[].ts', 'recap|closedSince.[].ts'],
    },
    {
      reason: 'the owner file refuses an id that is not o-<n>',
      paths: ['brief|ownerNotes.[].id'],
    },
    {
      reason: 'the read keeps only rows of one op, so it prints that op',
      paths: [
        'brief|decisions.[].op',
        'show|subjects.[].row.op',
        'list|rows.[].op',
        'recap|decidedSince.[].op',
        'recap|closedSince.[].op',
      ],
    },
    {
      reason: "the probe's own word for what it found",
      paths: ['brief|changed.[].now', 'show|subjects.[].checkedNow'],
    },
    {
      reason: 'gh gives a failing check its name, as run-show-command.test.ts shows',
      paths: ['show|subjects.[].failingChecks.[]'],
    },
    {
      reason: "the brief's open items and the recap's notes hold items.tsv rows only",
      paths: ['text', 'why', 'what', 'to', 'byWhen', 'words', 'where'].flatMap((field) => [
        `brief|open.[].row.${field}`,
        `recap|notes.[].item.row.${field}`,
      ]),
    },
  ];

  const placed = new Set([...tabled, ...named, ...ownClasses.flatMap((found) => found.paths)]);

  expect(ctx.schemaPaths.filter((path) => !placed.has(path))).toStrictEqual([]);
});

test.each(
  buildNamedCredentialCells().flatMap((found) =>
    buildJsonCellArgvs().map((read) => ({ cell: found.cell, argv: read.argv })),
  ),
)('it prints the placeholder for $cell holding a credential in www $argv --json', async (row) => {
  const ctx = setupTest();
  const found = ctx.named.find((entry) => entry.cell === row.cell);
  const value = found?.value ?? '';

  const plain = await ctx.readCells({}, row.argv);

  const printed = await ctx.readCells(
    { [row.cell]: value },
    row.argv.map((word) => (word === plainCells[row.cell] ? value : word)),
  );

  const windows = Array.from({ length: (found?.tail.length ?? 4) - 3 }, (_unused, index) =>
    found?.tail.slice(index, index + 4),
  );

  expect({
    exitCode: printed.exitCode,
    stdout: ctx.withoutEstimate(printed.stdout),
    leaked: windows.some((window) => `${printed.stdout}${printed.stderr}`.includes(window ?? '')),
  }).toStrictEqual({
    exitCode: plain.exitCode,
    stdout: ctx.expectStdout(plain.stdout, row.cell, '<where the secret lives>'),
    leaked: false,
  });
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

test("it leaves out the task's note row that holds a credential, keeps the other notes, and names notes.tsv on stderr", async () => {
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
    printed.map(() => ({
      exitCode: 0,
      rows: [
        { id: 'r-a', owed: false, written: '2026-03-10T09:00:00Z', note: 'Cite the spec' },
        { id: 'ok-a', owed: false, written: '2026-03-10T08:00:00Z', note: 'Ask jo first' },
        { id: 'w-c', owed: false, written: '2026-03-10T07:30:00Z', note: 'Ping kim at noon' },
        {
          id: 'wh-a',
          owed: false,
          written: '2026-03-10T07:00:00Z',
          note: 'Stop it with the kill switch',
        },
      ],
      names: true,
      leaked: false,
    })),
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

        expect((): unknown => JSON.parse(printed.stdout)).not.toThrow();
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
