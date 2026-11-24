import { expect, test } from 'bun:test';
import { toPlaceholder } from '../refusals/to-placeholder.ts';
import { buildMockSession } from '../test-utils/build-mock-session.ts';
import { buildParsedArgs } from '../test-utils/build-parsed-args.ts';
import { buildSpacedText } from '../test-utils/build-spaced-text.ts';
import { getPickedWrite } from '../test-utils/get-picked-write.ts';
import type { Grant } from '../types.ts';
import { pickGrantWrite } from './pick-grant-write.ts';

function setupTest() {
  const grant: Grant = {
    may: ['water the beds'],
    not: [],
    never: [],
    scope: null,
    reading: 'covers watering',
    where: 'terminal',
    set: '2026-03-03T09:00:00Z',
  };

  return {
    grant,
    pick: (argv: readonly string[], options: { byOwner?: boolean; grant?: Grant | null } = {}) =>
      pickGrantWrite({
        store: {
          folder: '/state/tide-alerts',
          session: buildMockSession({ grant: options.grant ?? null }),
          items: [],
          ownerNotes: [],
          notes: [],
          notesUnread: null,
          ownerUnread: null,
        },
        journal: {
          closed: new Map(),
          decisions: new Map(),
          lastDecisionNumber: 0,
          lastOwnerNoteNumber: 0,
        },
        args: buildParsedArgs(argv),
        cwd: '/work',
        nowMs: Date.parse('2026-03-10T11:43:00Z'),
        byOwner: options.byOwner ?? false,
      }),
    ones: (count: number) => Array.from({ length: count }, () => ['--may', 'o']).flat(),
    readRefusal: (picked: ReturnType<typeof pickGrantWrite>) =>
      picked.kind === 'refused' ? picked.refusal : null,
  };
}

test('it writes the bullets, the scope, the reading and where, with a journal row by the agent', () => {
  const ctx = setupTest();

  const picked = getPickedWrite(
    ctx.pick([
      'grant',
      '--may',
      'water the beds',
      '--may',
      'mow the lawn',
      '--never',
      'dig up the roses',
      '--scope',
      'in the east garden',
      '--where',
      'chat',
      '--reading',
      'covers watering and mowing',
    ]),
    9,
  );

  expect(picked).toStrictEqual({
    change: {
      session: buildMockSession({
        grant: {
          may: ['water the beds', 'mow the lawn'],
          not: [],
          never: ['dig up the roses'],
          scope: 'in the east garden',
          reading: 'covers watering and mowing',
          where: 'chat',
          set: '2026-03-10T11:43:00Z',
        },
        lastWrite: '2026-03-10T11:43:00Z',
      }),
      journal: [
        {
          ts: '2026-03-10T11:43:00Z',
          op: 'grant',
          id: 'grant',
          by: 'agent',
          text: 'may: water the beds • mow the lawn · never: dig up the roses · scope: in the east garden',
          why: 'covers watering and mowing',
          extra: 'where=chat',
        },
      ],
    },
    reply:
      'grant: 60 of 700 characters in 3 of 12 bullets on 3 of 19 lines, reading 26 of 200. Brief: 9 lines.',
  });
});

test('it writes the journal row by the owner when the owner-terminal test passes', () => {
  const ctx = setupTest();

  const picked = getPickedWrite(
    ctx.pick(['grant', '--may', 'Go.', '--where', 'chat', '--reading', 'all of it'], {
      byOwner: true,
    }),
    9,
  );

  expect(picked.change.journal.map((row) => row.by)).toStrictEqual(['owner']);
});

test('it replaces only the reading with --reading alone, and keeps the bullets, scope, where and set', () => {
  const ctx = setupTest();

  const picked = getPickedWrite(
    ctx.pick(['grant', '--reading', 'covers watering and nothing else'], {
      grant: { ...ctx.grant, not: ['prune the roses'], scope: 'in the east garden' },
    }),
    9,
  );

  expect({
    grant: picked.change.session?.grant,
    journal: picked.change.journal,
    reply: picked.reply,
  }).toStrictEqual({
    grant: {
      may: ['water the beds'],
      not: ['prune the roses'],
      never: [],
      scope: 'in the east garden',
      reading: 'covers watering and nothing else',
      where: 'terminal',
      set: '2026-03-03T09:00:00Z',
    },
    journal: [
      {
        ts: '2026-03-10T11:43:00Z',
        op: 'grant',
        id: 'grant',
        by: 'agent',
        text: 'may: water the beds · not: prune the roses · scope: in the east garden',
        why: 'covers watering and nothing else',
        extra: 'where=terminal;reading=1',
      },
    ],
    reply: 'grant reading: 32 of 200. Brief: 9 lines.',
  });
});

test.each([
  { title: 'a line feed', separator: '\n' },
  { title: 'a carriage return and a line feed', separator: '\r\n' },
  { title: 'a lone carriage return', separator: '\r' },
])('it turns $title in a bullet and the scope into one space before it counts', (row) => {
  const ctx = setupTest();

  const picked = getPickedWrite(
    ctx.pick([
      'grant',
      '--may',
      `water${row.separator}the beds`,
      '--not',
      `prune${row.separator}the roses`,
      '--scope',
      `east${row.separator}garden`,
      '--where',
      'chat',
      '--reading',
      'r',
    ]),
    9,
  );

  expect(picked.change.session?.grant).toStrictEqual({
    may: ['water the beds'],
    not: ['prune the roses'],
    never: [],
    scope: 'east garden',
    reading: 'r',
    where: 'chat',
    set: '2026-03-10T11:43:00Z',
  });
});

test('it takes 700 characters across bullets and scope, and refuses 701', () => {
  const ctx = setupTest();
  const bullets = ['--may', 'a'.repeat(120), '--may', 'b'.repeat(120), '--may', 'c'.repeat(120)];
  const tail = ['--where', 'chat', '--reading', 'r'];

  const over = ctx.pick([
    'grant',
    ...bullets,
    '--not',
    'd'.repeat(120),
    '--never',
    'e'.repeat(120),
    '--never',
    'f'.repeat(100),
    '--scope',
    'g',
    ...tail,
  ]);

  const exact = ctx.pick([
    'grant',
    ...bullets,
    '--not',
    'd'.repeat(120),
    '--never',
    'e'.repeat(120),
    '--never',
    'f'.repeat(99),
    '--scope',
    'g',
    ...tail,
  ]);

  expect([ctx.readRefusal(over)?.lines[0], exact.kind]).toStrictEqual([
    "www: refused: the grant's words are 701 characters in its bullets and scope, and the limit is 700.",
    'write',
  ]);
});

test('it writes a grant of only --not, with no may bullet', () => {
  const ctx = setupTest();

  const picked = getPickedWrite(
    ctx.pick([
      'grant',
      '--not',
      'replant the north beds before the soil report is in',
      '--where',
      'chat',
      '--reading',
      'covers nothing yet; kept back: replanting the north beds until the soil report is in',
    ]),
    9,
  );

  expect({
    grant: picked.change.session?.grant,
    journal: picked.change.journal.map((row) => [row.text, row.why, row.extra]),
    reply: picked.reply,
  }).toStrictEqual({
    grant: {
      may: [],
      not: ['replant the north beds before the soil report is in'],
      never: [],
      scope: null,
      reading:
        'covers nothing yet; kept back: replanting the north beds until the soil report is in',
      where: 'chat',
      set: '2026-03-10T11:43:00Z',
    },
    journal: [
      [
        'not: replant the north beds before the soil report is in',
        'covers nothing yet; kept back: replanting the north beds until the soil report is in',
        'where=chat',
      ],
    ],
    reply:
      'grant: 51 of 700 characters in 1 of 12 bullets on 1 of 19 lines, reading 84 of 200. Brief: 9 lines.',
  });
});

test('it keeps the not bullet of a grant of only --not when --reading comes alone', () => {
  const ctx = setupTest();

  const picked = getPickedWrite(
    ctx.pick(['grant', '--reading', 'covers nothing yet'], {
      grant: { ...ctx.grant, may: [], not: ['prune the roses'] },
    }),
    9,
  );

  expect(picked.change.session?.grant).toStrictEqual({
    ...ctx.grant,
    may: [],
    not: ['prune the roses'],
    reading: 'covers nothing yet',
  });
});

test('it writes a bullet of 162 characters and counts its two lines', () => {
  const ctx = setupTest();

  const picked = getPickedWrite(
    ctx.pick(['grant', '--may', buildSpacedText(162), '--where', 'chat', '--reading', 'r']),
    9,
  );

  expect(picked.reply).toBe(
    'grant: 162 of 700 characters in 1 of 12 bullets on 2 of 19 lines, reading 1 of 200. Brief: 9 lines.',
  );
});

test('it writes a may bullet of 162 characters and a not bullet and counts 3 lines', () => {
  const ctx = setupTest();

  const picked = getPickedWrite(
    ctx.pick([
      'grant',
      '--may',
      'merge the garden-api pull requests yourself once CI is green, every review finding is answered, and the staging beds have run the new build for a full day',
      '--not',
      'replant the north beds before the soil report is in',
      '--where',
      'chat',
      '--reading',
      'covers garden-api merges after a day on the staging beds; kept back: replanting the north beds',
    ]),
    9,
  );

  expect(picked.reply).toBe(
    'grant: 205 of 700 characters in 2 of 12 bullets on 3 of 19 lines, reading 94 of 200. Brief: 9 lines.',
  );
});

test('it writes one bullet of 700 characters with no space, on 8 lines', () => {
  const ctx = setupTest();

  const picked = getPickedWrite(
    ctx.pick(['grant', '--may', 'x'.repeat(700), '--where', 'chat', '--reading', 'r']),
    9,
  );

  expect(picked.reply).toBe(
    'grant: 700 of 700 characters in 1 of 12 bullets on 8 of 19 lines, reading 1 of 200. Brief: 9 lines.',
  );
});

test('it writes the widest grant of 7 bullets of 90 and 5 of 6 with a scope of 40 on 19 of 19 lines', () => {
  const ctx = setupTest();

  const picked = getPickedWrite(
    ctx.pick([
      'grant',
      ...Array.from({ length: 7 }, () => ['--may', 'm'.repeat(90)]).flat(),
      ...Array.from({ length: 5 }, () => ['--not', 'x'.repeat(6)]).flat(),
      '--scope',
      's'.repeat(40),
      '--where',
      'chat',
      '--reading',
      'r',
    ]),
    9,
  );

  expect(picked.reply).toBe(
    'grant: 700 of 700 characters in 12 of 12 bullets on 19 of 19 lines, reading 1 of 200. Brief: 9 lines.',
  );
});

test('it refuses a grant of 20 lines in the brief, and takes one of 19', () => {
  const ctx = setupTest();
  const tail = ['--where', 'chat', '--reading', 'r'];
  const long = buildSpacedText(649, 74);
  const over = ctx.pick(['grant', '--may', long, ...ctx.ones(11), ...tail]);
  const exact = ctx.pick(['grant', '--may', long, ...ctx.ones(10), ...tail]);

  expect([ctx.readRefusal(over)?.lines[0], exact.kind]).toStrictEqual([
    'www: refused: the grant takes 20 lines in the brief, and the limit is 19. Join short parts that belong together in one bullet, or put a long part in fewer words.',
    'write',
  ]);
});

test('it counts code points, so a bullet of 120 astral characters passes', () => {
  const ctx = setupTest();

  const picked = ctx.pick([
    'grant',
    '--may',
    '\u{1F331}'.repeat(120),
    '--where',
    'chat',
    '--reading',
    'r',
  ]);

  expect(picked.kind).toBe('write');
});

test.each([
  {
    title: 'no flag',
    argv: ['grant'],
    line: "www: refused: a grant needs at least one --may, --not or --never in the owner's words, where they were given, and your reading of what they cover and what the owner kept back.",
  },
  {
    title: 'only --may',
    argv: ['grant', '--may', 'Go.'],
    line: "www: refused: a grant needs at least one --may, --not or --never in the owner's words, where they were given, and your reading of what they cover and what the owner kept back.",
  },
  {
    title: 'only --scope, --where and --reading',
    argv: ['grant', '--scope', 'in garden-api', '--where', 'chat', '--reading', 'r'],
    line: "www: refused: a grant needs at least one --may, --not or --never in the owner's words, where they were given, and your reading of what they cover and what the owner kept back.",
  },
  {
    title: 'only --where',
    argv: ['grant', '--where', 'chat'],
    line: "www: refused: a grant needs at least one --may, --not or --never in the owner's words, where they were given, and your reading of what they cover and what the owner kept back.",
  },
  {
    title: '--reading alone, with no grant to read',
    argv: ['grant', '--reading', 'covers watering'],
    line: 'www: refused: tide-alerts has no grant, so there is no reading to replace.',
  },
  {
    title: '13 bullets',
    argv: [
      'grant',
      ...Array.from({ length: 13 }, () => ['--may', 'water']).flat(),
      '--where',
      'chat',
      '--reading',
      'r',
    ],
    line: 'www: refused: the grant has 13 bullets, and the limit is 12. Put two parts that belong together in one bullet.',
  },
  {
    title: 'a scope of 41 characters',
    argv: ['grant', '--may', 'Go.', '--scope', 's'.repeat(41), '--where', 'chat', '--reading', 'r'],
    line: "www: refused: the grant's scope is 41 characters, and the limit is 40.",
  },
  {
    title: 'a reading of 201 characters',
    argv: ['grant', '--may', 'Go.', '--where', 'chat', '--reading', 'r'.repeat(201)],
    line: 'www: refused: the reading is 201 characters, and the limit is 200.',
  },
  {
    title: 'a where of 17 characters',
    argv: ['grant', '--may', 'Go.', '--where', 'w'.repeat(17), '--reading', 'r'],
    line: 'www: refused: the where is 17 characters, and the limit is 16. Write what is true now; the story belongs in a PR or a commit.',
  },
  {
    title: 'a where with a semicolon',
    argv: ['grant', '--may', 'Go.', '--where', 'chat;x', '--reading', 'r'],
    line: 'www: refused: --where cannot hold ; or =.',
  },
])('it refuses $title', (row) => {
  const ctx = setupTest();
  const picked = ctx.pick(row.argv);

  expect(ctx.readRefusal(picked)?.lines[0]).toBe(row.line);
});

test('it puts the one placeholder of each typed group at the first bullet of a grant with 13 bullets', () => {
  const ctx = setupTest();

  const picked = ctx.pick([
    'grant',
    ...Array.from({ length: 12 }, () => ['--may', 'water']).flat(),
    '--never',
    'dig up the roses',
    '--where',
    'chat',
    '--reading',
    'r',
  ]);

  expect(ctx.readRefusal(picked)?.runs).toStrictEqual([
    {
      www: [
        'grant',
        '--may',
        toPlaceholder('<what the owner allows, in their words>'),
        '--never',
        toPlaceholder('<what the owner ruled out, in their words>'),
        '--where',
        'chat',
        '--reading',
        'r',
      ],
    },
  ]);
});

test('it replaces only the scope when it is 41 characters long, in the Run line', () => {
  const ctx = setupTest();

  const picked = ctx.pick([
    'grant',
    '--may',
    'water the beds',
    '--scope',
    's'.repeat(41),
    '--where',
    'chat',
    '--reading',
    'r',
  ]);

  expect(ctx.readRefusal(picked)?.runs).toStrictEqual([
    {
      www: [
        'grant',
        '--may',
        'water the beds',
        '--scope',
        toPlaceholder("<grant's scope of at most 40 characters>"),
        '--where',
        'chat',
        '--reading',
        'r',
      ],
    },
  ]);
});

test('it refuses a credential in a bullet and replaces only that value in the Run line', () => {
  const ctx = setupTest();
  const prefix = ['ghp', '_'].join('');
  const secret = [prefix, 'a'.repeat(36)].join('');

  const picked = ctx.pick([
    'grant',
    '--may',
    'water the beds',
    '--not',
    `token ${secret}`,
    '--where',
    'chat',
    '--reading',
    'r',
  ]);

  expect([ctx.readRefusal(picked)?.lines, ctx.readRefusal(picked)?.runs]).toStrictEqual([
    [
      `www: refused: the text looks like a credential (it matches the ghp pattern). Write where the secret lives, never its value.`,
    ],
    [
      {
        www: [
          'grant',
          '--may',
          'water the beds',
          '--not',
          toPlaceholder('<where the secret lives>'),
          '--where',
          'chat',
          '--reading',
          'r',
        ],
      },
    ],
  ]);
});

test.each([
  { title: 'the scope', flag: '--scope' },
  { title: 'the reading', flag: '--reading' },
])('it refuses a credential in $title', (row) => {
  const ctx = setupTest();
  const prefix = ['ghp', '_'].join('');
  const secret = [prefix, 'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8'].join('');
  const reading = row.flag === '--reading' ? `token ${secret}` : 'r';
  const scope = row.flag === '--scope' ? ['--scope', secret] : [];

  const picked = ctx.pick([
    'grant',
    '--may',
    'Go.',
    ...scope,
    '--reading',
    reading,
    '--where',
    'chat',
  ]);

  expect(ctx.readRefusal(picked)?.lines[0]).toBe(
    `www: refused: the text looks like a credential (it matches the ghp pattern). Write where the secret lives, never its value.`,
  );
});

test.each([
  [
    'a grant of 20 lines and no --where',
    [
      'grant',
      '--may',
      buildSpacedText(649, 74),
      ...Array.from({ length: 11 }, () => ['--may', 'o']).flat(),
      '--reading',
      'r',
    ],
    [
      "www: refused: a grant needs at least one --may, --not or --never in the owner's words, where they were given, and your reading of what they cover and what the owner kept back.",
      'www: refused: the grant takes 20 lines in the brief, and the limit is 19. Join short parts that belong together in one bullet, or put a long part in fewer words.',
    ],
    [
      'grant',
      '--may',
      toPlaceholder('<what the owner allows, in their words>'),
      '--reading',
      'r',
      '--where',
      'chat',
    ],
  ],
  [
    'a reading over 200 characters on a session with no grant',
    ['grant', '--reading', 'r'.repeat(201)],
    [
      'www: refused: tide-alerts has no grant, so there is no reading to replace.',
      'www: refused: the reading is 201 characters, and the limit is 200.',
    ],
    [
      'grant',
      '--may',
      toPlaceholder('<what the owner allows, in their words>'),
      '--where',
      toPlaceholder('<where>'),
      '--reading',
      toPlaceholder('<reading of at most 200 characters>'),
    ],
  ],
])(
  'it prints each problem and one Run line that fixes them all, for %s',
  (_title, argv, lines, run) => {
    const ctx = setupTest();

    expect(ctx.readRefusal(ctx.pick(argv))).toStrictEqual({
      exitCode: 3,
      lines,
      runs: [{ www: run }],
    });
  },
);
