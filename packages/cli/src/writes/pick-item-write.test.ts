import { expect, test } from 'bun:test';
import { toPlaceholder } from '../refusals/to-placeholder.ts';
import { buildMockItem } from '../test-utils/build-mock-item.ts';
import { buildMockNote } from '../test-utils/build-mock-note.ts';
import { buildOkArgv } from '../test-utils/build-ok-argv.ts';
import { buildParsedArgs } from '../test-utils/build-parsed-args.ts';
import { getPickedWrite } from '../test-utils/get-picked-write.ts';
import type { Item, Note, SessionFile } from '../types.ts';
import { pickItemWrite } from './pick-item-write.ts';

function setupTest() {
  const session: SessionFile = {
    format: '2',
    grant: null,
    name: 'tide-alerts',
    goal: 'Ship it',
    started: '2026-03-02T08:04:11Z',
    now: null,
    nowNext: null,
    nowSet: null,
    lastWrite: null,
    lastNudge: null,
    importedFrom: null,
  };

  return {
    pick: (argv: readonly string[], items: readonly Item[], notes: readonly Note[] = []) =>
      pickItemWrite({
        store: {
          folder: '/state/tide-alerts',
          session,
          items,
          ownerNotes: [],
          notes,
          notesUnread: null,
          prs: [],
          prsUnread: null,
          lessons: [],
          lessonsUnread: null,
          promises: [],
          promisesUnread: null,
          words: [],
          wordsUnread: null,
          ownerUnread: null,
        },
        journal: {
          closed: new Map(),
          decisions: new Map(),
          lastDecisionNumber: 0,
          replaced: new Set(),
          inForce: [],
          lastOwnerNoteNumber: 0,
        },
        args: buildParsedArgs(argv),
        cwd: '/work',
        nowMs: Date.parse('2026-03-10T11:43:00Z'),
        probed: null,
      }),
  };
}

test('it writes an approval as an item that keeps the quote as its claim and the parts in its extra', () => {
  const ctx = setupTest();
  const picked = ctx.pick(buildOkArgv(), []);

  expect(picked).toStrictEqual({
    kind: 'write',
    change: {
      items: [
        {
          id: 'ok-merge',
          kind: 'ok',
          claim: 'merge the alert PRs yourself',
          check: null,
          atWrite: null,
          last: null,
          written: '2026-03-10T11:43:00Z',
          by: 'agent',
          extra: { who: 'owner', where: 'terminal', scope: 'bosun-api' },
        },
      ],
      session: expect.objectContaining({ lastWrite: '2026-03-10T11:43:00Z' }),
      journal: [
        {
          ts: '2026-03-10T11:43:00Z',
          op: 'ok',
          id: 'ok-merge',
          by: 'agent',
          text: 'merge the alert PRs yourself',
          why: null,
          extra: null,
        },
      ],
    },
    reply: expect.any(Function),
  });
});

test('it writes the same approval for ok --once, which it accepts and ignores', () => {
  const ctx = setupTest();
  const withOnce = getPickedWrite(ctx.pick(buildOkArgv('--once'), []), 9);
  const withoutOnce = getPickedWrite(ctx.pick(buildOkArgv(), []), 9);

  expect(withOnce).toStrictEqual(withoutOnce);
});

test('it refuses ok --standing and sends the owner words to the grant', () => {
  const ctx = setupTest();
  const picked = ctx.pick(buildOkArgv('--standing'), []);

  expect(picked).toStrictEqual({
    kind: 'refused',
    refusal: {
      exitCode: 3,
      lines: ["www: refused: lasting permission lives in the grant, in the owner's words whole."],
      runs: [
        {
          www: [
            'grant',
            '--may',
            toPlaceholder('<what the owner allows, in their words>'),
            '--where',
            'terminal',
            '--reading',
            toPlaceholder('<what they cover; what the owner kept back>'),
          ],
        },
      ],
    },
  });
});

test('it replaces the whole item of an open approval with the same id', () => {
  const ctx = setupTest();

  const old = buildMockItem({
    id: 'ok-merge',
    kind: 'ok',
    claim: 'the old words',
    extra: { who: 'sam', where: 'chat', scope: 'old' },
  });

  const picked = ctx.pick(buildOkArgv(), [old]);

  expect(picked).toMatchObject({
    kind: 'write',
    change: {
      items: [
        {
          id: 'ok-merge',
          claim: 'merge the alert PRs yourself',
          extra: { who: 'owner', where: 'terminal', scope: 'bosun-api' },
        },
      ],
    },
  });
});

test('it replies with the approval as ok, open, with no check', () => {
  const ctx = setupTest();
  const picked = ctx.pick(buildOkArgv(), []);

  expect(getPickedWrite(picked, 9).reply).toBe(
    'ok-merge  ok, open, no check. Brief: 9 of 8000 tokens.',
  );
});

test('it refuses a second approval and names the open one to spend', () => {
  const ctx = setupTest();
  const full = ['ok-a'].map((id) => buildMockItem({ id, kind: 'ok' }));
  const picked = ctx.pick(buildOkArgv(), full);

  expect(picked).toStrictEqual({
    kind: 'refused',
    refusal: {
      exitCode: 3,
      lines: [
        'www: refused: the session holds 1 of 1 one-time approvals. Spend it with www use, or drop it.',
      ],
      runs: [{ www: ['use', 'ok-a', '--for', toPlaceholder('<what you did with it>')] }],
    },
  });
});

test('it replaces the open approval of the same id when the cap is full', () => {
  const ctx = setupTest();
  const full = ['ok-merge'].map((id) => buildMockItem({ id, kind: 'ok' }));
  const picked = ctx.pick(buildOkArgv(), full);

  expect(picked.kind).toBe('write');
});

test.each([
  ['no --quote', ['ok', 'ok-a', '--who', 'o', '--where', 'w', '--scope', 's']],
  ['no --who', ['ok', 'ok-a', '--quote', 'q', '--where', 'w', '--scope', 's']],
  ['no --where', ['ok', 'ok-a', '--quote', 'q', '--who', 'o', '--scope', 's']],
  ['no --scope', ['ok', 'ok-a', '--quote', 'q', '--who', 'o', '--where', 'w']],
])('it refuses an approval with %s as lacking a part', (_title, argv) => {
  const ctx = setupTest();
  const picked = ctx.pick(argv, []);

  expect(picked).toStrictEqual({
    kind: 'refused',
    refusal: expect.objectContaining({
      exitCode: 3,
      lines: [
        "www: refused: an approval needs the owner's exact words, who gave them, where, and what they cover.",
      ],
    }),
  });
});

test.each([
  ['quote', 'a'.repeat(120), 'write'],
  ['quote', 'a'.repeat(121), 'refused'],
  ['who', 'a'.repeat(16), 'write'],
  ['who', 'a'.repeat(17), 'refused'],
  ['where', 'a'.repeat(16), 'write'],
  ['where', 'a'.repeat(17), 'refused'],
  ['scope', 'a'.repeat(40), 'write'],
  ['scope', 'a'.repeat(41), 'refused'],
  ['who', 'a;b', 'refused'],
  ['where', 'a=b', 'refused'],
  ['scope', 'a;b=c', 'refused'],
] as const)('it takes a --%s of %p as %s', (flag, value, kind) => {
  const ctx = setupTest();

  const argv = [
    'ok',
    'ok-a',
    '--quote',
    flag === 'quote' ? value : 'q',
    '--who',
    flag === 'who' ? value : 'o',
    '--where',
    flag === 'where' ? value : 'w',
    '--scope',
    flag === 'scope' ? value : 's',
  ];

  const picked = ctx.pick(argv, []);

  expect(picked.kind).toBe(kind);
});

test('it journals the check of a set on an approval', () => {
  const ctx = setupTest();

  const picked = ctx.pick(
    ['set', 'ok-merge', 'Updated quote', '--pid', '123'],
    [
      buildMockItem({
        id: 'ok-merge',
        kind: 'ok',
        claim: 'merge the alert PRs yourself',
        extra: { who: 'owner', where: 'terminal', scope: 'bosun-api' },
      }),
    ],
  );

  expect(picked).toMatchObject({
    kind: 'write',
    change: {
      items: [{ id: 'ok-merge', check: 'pid:123' }],
      journal: [{ op: 'set', id: 'ok-merge', extra: 'check=pid:123' }],
    },
  });
});

test('it writes a new item with its owed note, journals the note row after the item and replies with the note part', () => {
  const ctx = setupTest();

  const picked = getPickedWrite(
    ctx.pick(['task', 't-a', 'Wire the sensor', '--note', 'Stop the simulator', '--owed'], []),
    6,
  );

  expect(picked).toStrictEqual({
    change: {
      items: [expect.objectContaining({ id: 't-a', claim: 'Wire the sensor' })],
      notes: [
        {
          id: 't-a',
          owed: true,
          written: '2026-03-10T11:43:00Z',
          note: 'Stop the simulator',
        },
      ],
      session: expect.objectContaining({ lastWrite: '2026-03-10T11:43:00Z' }),
      journal: [
        expect.objectContaining({ op: 'task', id: 't-a', text: 'Wire the sensor', extra: null }),
        {
          ts: '2026-03-10T11:43:00Z',
          op: 'note',
          id: 't-a',
          by: 'agent',
          text: 'Stop the simulator',
          why: null,
          extra: 'owed=1',
        },
      ],
    },
    reply: 't-a  task, open, no check, note 18 of 400, owed. Brief: 6 of 8000 tokens.',
  });
});

test.each(
  [
    {
      command: 'task',
      argv: ['task', 't-a', 'Wire it'],
      items: [],
      item: { id: 't-a', kind: 'task' as const, claim: 'Wire it', extra: {} },
      journalOp: 'task',
      journalExtra: null,
      replyHead: 't-a  task, open, no check',
    },
    {
      command: 'wait',
      argv: ['wait', 'w-a', 'The vendor replies', '--who', 'vendor'],
      items: [],
      item: {
        id: 'w-a',
        kind: 'wait' as const,
        claim: 'The vendor replies',
        extra: { who: 'vendor' },
      },
      journalOp: 'wait',
      journalExtra: null,
      replyHead: 'w-a  wait, open, no check',
    },
    {
      command: 'rule',
      argv: ['rule', 'r-a', 'Run from api/'],
      items: [],
      item: { id: 'r-a', kind: 'rule' as const, claim: 'Run from api/', extra: {} },
      journalOp: 'rule',
      journalExtra: null,
      replyHead: 'r-a  rule, open',
    },
    {
      command: 'where',
      argv: ['where', 'wh-a', 'Kiln simulator'],
      items: [],
      item: { id: 'wh-a', kind: 'where' as const, claim: 'Kiln simulator', extra: {} },
      journalOp: 'where',
      journalExtra: null,
      replyHead: 'wh-a  where, open, no check',
    },
    {
      command: 'ok',
      argv: buildOkArgv(),
      items: [],
      item: {
        id: 'ok-merge',
        kind: 'ok' as const,
        claim: 'merge the alert PRs yourself',
        extra: { who: 'owner', where: 'terminal', scope: 'bosun-api' as const },
      },
      journalOp: 'ok',
      journalExtra: null,
      replyHead: 'ok-merge  ok, open, no check',
    },
    {
      command: 'set with a claim',
      argv: ['set', 't-a', 'Wire it again'],
      items: [buildMockItem({ id: 't-a' })],
      item: { id: 't-a', kind: 'task' as const, claim: 'Wire it again', extra: {} },
      journalOp: 'set',
      journalExtra: null,
      replyHead: 't-a  task, open, no check',
    },
  ].flatMap((row) => [
    { row, owed: true },
    { row, owed: false },
  ]),
)('it writes $found.row.command with owed $owed, with its whole change and reply', (found) => {
  const ctx = setupTest();

  const picked = getPickedWrite(
    ctx.pick(
      [...found.row.argv, '--note', 'Stop the simulator', ...(found.owed ? ['--owed'] : [])],
      found.row.items,
    ),
    6,
  );

  expect(picked).toStrictEqual({
    change: {
      items: [
        {
          check: null,
          atWrite: null,
          last: null,
          written: '2026-03-10T11:43:00Z',
          by: 'agent',
          ...found.row.item,
        },
      ],
      notes: [
        {
          id: found.row.item.id,
          owed: found.owed,
          written: '2026-03-10T11:43:00Z',
          note: 'Stop the simulator',
        },
      ],
      session: expect.objectContaining({ lastWrite: '2026-03-10T11:43:00Z' }),
      journal: [
        {
          ts: '2026-03-10T11:43:00Z',
          op: found.row.journalOp,
          id: found.row.item.id,
          by: 'agent',
          text: found.row.item.claim,
          why: null,
          extra: found.row.journalExtra,
        },
        {
          ts: '2026-03-10T11:43:00Z',
          op: 'note',
          id: found.row.item.id,
          by: 'agent',
          text: 'Stop the simulator',
          why: null,
          extra: found.owed ? 'owed=1' : null,
        },
      ],
    },
    reply: `${found.row.replyHead}, note 18 of 400${found.owed ? ', owed' : ''}. Brief: 6 of 8000 tokens.`,
  });
});

test('it writes a note that is not owed with no owed part in the reply or the journal', () => {
  const ctx = setupTest();
  const picked = getPickedWrite(ctx.pick(['rule', 'r-a', 'Run from api/', '--note', 'Why'], []), 6);

  expect(picked).toStrictEqual({
    change: expect.objectContaining({
      notes: [{ id: 'r-a', owed: false, written: '2026-03-10T11:43:00Z', note: 'Why' }],
      journal: [
        expect.objectContaining({ op: 'rule' }),
        expect.objectContaining({ op: 'note', text: 'Why', extra: null }),
      ],
    }),
    reply: 'r-a  rule, open, note 3 of 400. Brief: 6 of 8000 tokens.',
  });
});

test('it replies ok, open, no check for an approval with a note', () => {
  const ctx = setupTest();

  const picked = getPickedWrite(
    ctx.pick([...buildOkArgv(), '--note', 'Spent on the merge'], []),
    6,
  );

  expect(picked.reply).toBe(
    'ok-merge  ok, open, no check, note 18 of 400. Brief: 6 of 8000 tokens.',
  );
});

test('it keeps the note row, its owed flag and its written time when a claim write gives no note flag', () => {
  const ctx = setupTest();

  const oldNote = buildMockNote({
    id: 't-a',
    owed: true,
    written: '2026-03-10T10:43:00Z',
    note: 'Switch the kiln simulator off before this closes',
  });

  const task = buildMockItem({
    id: 't-a',
    claim: 'Wire the sensor',
    check: 'pid:42',
    atWrite: 'alive',
    written: '2026-03-10T10:31:09Z',
  });

  const picked = getPickedWrite(ctx.pick(['task', 't-a', 'Wire it again'], [task], [oldNote]), 6);

  expect(picked.change).toStrictEqual({
    items: [expect.objectContaining({ id: 't-a', claim: 'Wire it again' })],
    session: expect.objectContaining({ lastWrite: '2026-03-10T11:43:00Z' }),
    journal: [expect.objectContaining({ op: 'task' })],
  });
});

test('it adds the older-note line when a write replaces the claim and keeps a note', () => {
  const ctx = setupTest();

  const oldNote = buildMockNote({
    id: 't-a',
    owed: true,
    written: '2026-03-10T10:43:00Z',
    note: 'Switch the kiln simulator off before this closes',
  });

  const task = buildMockItem({
    id: 't-a',
    claim: 'Wire the sensor',
    check: 'pid:42',
    atWrite: 'alive',
    written: '2026-03-10T10:31:09Z',
  });

  const picked = getPickedWrite(ctx.pick(['set', 't-a', 'Wire it again'], [task], [oldNote]), 6);

  expect(picked.reply).toBe(
    [
      '  its note is 1h older than this claim. Replace it with www set t-a --note "<detail>", or clear it with www set t-a --no-note',
      't-a  task, open, checked now: unchecked. Brief: 6 of 8000 tokens.',
    ].join('\n'),
  );
});

test('it keeps the typed --session in the older-note commands', () => {
  const ctx = setupTest();

  const oldNote = buildMockNote({
    id: 't-a',
    owed: true,
    written: '2026-03-10T10:43:00Z',
    note: 'Switch the kiln simulator off before this closes',
  });

  const task = buildMockItem({
    id: 't-a',
    claim: 'Wire the sensor',
    check: 'pid:42',
    atWrite: 'alive',
    written: '2026-03-10T10:31:09Z',
  });

  const picked = getPickedWrite(
    ctx.pick(['set', 't-a', 'Wire it again', '--session', 'tide-alerts'], [task], [oldNote]),
    6,
  );

  expect(picked.reply.split('\n')[0]).toBe(
    '  its note is 1h older than this claim. Replace it with www --session tide-alerts set t-a --note "<detail>", or clear it with www --session tide-alerts set t-a --no-note',
  );
});

test('it adds no older-note line when the write replaces the note, clears it or the item has none', () => {
  const ctx = setupTest();

  const oldNote = buildMockNote({
    id: 't-a',
    owed: true,
    written: '2026-03-10T10:43:00Z',
    note: 'Switch the kiln simulator off before this closes',
  });

  const task = buildMockItem({
    id: 't-a',
    claim: 'Wire the sensor',
    check: 'pid:42',
    atWrite: 'alive',
    written: '2026-03-10T10:31:09Z',
  });

  const replies = [
    ctx.pick(['set', 't-a', 'Wire it again', '--note', 'New'], [task], [oldNote]),
    ctx.pick(['set', 't-a', 'Wire it again', '--no-note'], [task], [oldNote]),
    ctx.pick(['set', 't-a', 'Wire it again'], [task], []),
  ].map((picked) => getPickedWrite(picked, 6).reply);

  expect(replies).toStrictEqual([
    't-a  task, open, checked now: unchecked, note 3 of 400. Brief: 6 of 8000 tokens.',
    't-a  task, open, checked now: unchecked. Brief: 6 of 8000 tokens.',
    't-a  task, open, checked now: unchecked. Brief: 6 of 8000 tokens.',
  ]);
});

test('it keeps the claim, check, at_write and written of the item when set gives only a note', () => {
  const ctx = setupTest();

  const task = buildMockItem({
    id: 't-a',
    claim: 'Wire the sensor',
    check: 'pid:42',
    atWrite: 'alive',
    written: '2026-03-10T10:31:09Z',
  });

  const picked = getPickedWrite(ctx.pick(['set', 't-a', '--note', 'Fresh note'], [task]), 6);

  expect(picked).toStrictEqual({
    change: {
      notes: [{ id: 't-a', owed: false, written: '2026-03-10T11:43:00Z', note: 'Fresh note' }],
      session: expect.objectContaining({ lastWrite: '2026-03-10T11:43:00Z' }),
      journal: [
        {
          ts: '2026-03-10T11:43:00Z',
          op: 'note',
          id: 't-a',
          by: 'agent',
          text: 'Fresh note',
          why: null,
          extra: null,
        },
      ],
    },
    reply: 't-a  note, 10 of 400. Brief: 6 of 8000 tokens.',
  });
});

test('it replies with the owed part when set gives only an owed note', () => {
  const ctx = setupTest();

  const task = buildMockItem({
    id: 't-a',
    claim: 'Wire the sensor',
    check: 'pid:42',
    atWrite: 'alive',
    written: '2026-03-10T10:31:09Z',
  });

  const picked = getPickedWrite(
    ctx.pick(['set', 't-a', '--note', 'Fresh note', '--owed'], [task]),
    6,
  );

  expect(picked.reply).toBe('t-a  note, 10 of 400, owed. Brief: 6 of 8000 tokens.');
});

test('it clears the note with set --no-note and journals note cleared', () => {
  const ctx = setupTest();

  const oldNote = buildMockNote({
    id: 't-a',
    owed: true,
    written: '2026-03-10T10:43:00Z',
    note: 'Switch the kiln simulator off before this closes',
  });

  const task = buildMockItem({
    id: 't-a',
    claim: 'Wire the sensor',
    check: 'pid:42',
    atWrite: 'alive',
    written: '2026-03-10T10:31:09Z',
  });

  const picked = getPickedWrite(ctx.pick(['set', 't-a', '--no-note'], [task], [oldNote]), 6);

  expect(picked).toStrictEqual({
    change: {
      notes: [],
      session: expect.objectContaining({ lastWrite: '2026-03-10T11:43:00Z' }),
      journal: [
        {
          ts: '2026-03-10T11:43:00Z',
          op: 'note',
          id: 't-a',
          by: 'agent',
          text: null,
          why: null,
          extra: 'cleared=1',
        },
      ],
    },
    reply: 't-a  note cleared. Brief: 6 of 8000 tokens.',
  });
});

test.each([
  [
    'a check and no claim',
    ['set', 't-a', '--pid', '5'],
    'www: refused: a check belongs to a claim, and set with no claim changes only the note.',
  ],
  [
    'a check, a note and no claim',
    ['set', 't-a', '--pid', '5', '--note', 'x'],
    'www: refused: a check belongs to a claim, and set with no claim changes only the note.',
  ],
  ['only an id', ['set', 't-a'], 'www: refused: set needs a claim, --note or --no-note.'],
  [
    'a note over 400 characters',
    ['task', 't-b', 'Claim', '--note', 'n'.repeat(401)],
    'www: refused: the note is 401 characters, and the limit is 400. Keep what you need on your next turn to this item, and link the rest from a PR, an issue or a file.',
  ],
  ['no note to clear', ['set', 't-a', '--no-note'], 'www: refused: t-a has no note to clear.'],
  [
    'an owed flag and no note',
    ['task', 't-b', 'Claim', '--owed'],
    'www: refused: --owed marks a note, and this command gives none.',
  ],
  [
    'a note and --no-note',
    ['set', 't-a', 'Claim', '--note', 'x', '--no-note'],
    'www: refused: --note replaces the note and --no-note clears it; give one.',
  ],
])('it refuses set or a write with %s', (_title, argv, line) => {
  const ctx = setupTest();

  const task = buildMockItem({
    id: 't-a',
    claim: 'Wire the sensor',
    check: 'pid:42',
    atWrite: 'alive',
    written: '2026-03-10T10:31:09Z',
  });

  const picked = ctx.pick(argv, [task]);

  expect(picked.kind === 'refused' && picked.refusal.lines[0]).toBe(line);
});
