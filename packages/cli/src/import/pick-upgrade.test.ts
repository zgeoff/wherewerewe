import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { buildParsedArgs } from '../test-utils/build-parsed-args.ts';
import { buildSpacedText } from '../test-utils/build-spaced-text.ts';
import { seedFormat1Store } from '../test-utils/seed-format-1-store.ts';
import type { AgentID } from '../types.ts';
import { pickUpgrade } from './pick-upgrade.ts';
import type { Format1Files, UpgradePick } from './pick-upgrade.ts';

type UpgradeOf = Extract<UpgradePick, { kind: 'upgrade' }>;

function setupTest() {
  const root = createTempDir('pick-upgrade').path;
  const folder = seedFormat1Store(root, 'garden-beds');
  const read = (file: string) => readFileSync(join(folder, file), 'utf8');

  const files: Format1Files = {
    session: read('session'),
    items: read('items.tsv'),
    notes: read('notes.tsv'),
    journal: read('journal.tsv'),
  };

  const grantFlags = [
    '--may',
    'Merge and deploy to the staging beds yourself.',
    '--where',
    'chat',
    '--reading',
    'covers garden-api merges and staging deploys',
  ];

  const pick = (
    argv: readonly string[],
    options: { files?: Partial<Format1Files>; agent?: AgentID | null; byOwner?: boolean } = {},
  ): UpgradePick =>
    pickUpgrade(
      { ...files, ...options.files },
      {
        name: 'garden-beds',
        folder: '/state/garden-beds',
        args: buildParsedArgs(['import', 'garden-beds', ...argv]),
        nowMs: Date.parse('2026-03-10T11:43:00Z'),
        byOwner: options.byOwner ?? false,
        agent: options.agent ?? null,
      },
    );

  return {
    files,
    grantFlags,
    pick,
    pickUpgraded: (
      argv: readonly string[],
      options: { files?: Partial<Format1Files>; agent?: AgentID | null; byOwner?: boolean } = {},
    ): UpgradeOf => {
      const picked = pick(argv, options);

      if (picked.kind === 'refused') {
        throw new Error(`the upgrade is refused: ${picked.refusal.lines.join(' ')}`);
      }

      return picked;
    },
    dropLines: (items: string, ids: readonly string[]): string =>
      items
        .split('\n')
        .filter((line) => !ids.some((id) => line.startsWith(`${id}\t`)))
        .join('\n'),
    readRefusal: (picked: UpgradePick): string[] | null => {
      if (picked.kind !== 'refused') {
        return null;
      }

      const runs = picked.refusal.runs.map((run) =>
        'www' in run
          ? `Run: www ${run.www.map((word) => (typeof word === 'string' ? word : word.placeholder)).join(' ')}`
          : '',
      );

      return [...picked.refusal.lines, ...runs];
    },
  };
}

test('it folds the standing approvals into the grant and keeps the one-time approval', () => {
  const ctx = setupTest();
  const picked = ctx.pickUpgraded(ctx.grantFlags);

  expect({
    session: picked.session,
    itemIDs: picked.items.map((item) => item.id),
    kept: picked.items.find((item) => item.id === 'ok-wipe'),
    notes: picked.notes,
    removedNotes: picked.removedNotes.map((note) => note.id),
    journalRows: picked.journalRows,
    folded: picked.folded,
    keptCount: picked.kept,
  }).toStrictEqual({
    session: {
      format: '2',
      name: 'garden-beds',
      goal: 'Ship soil-moisture alerts for the garden irrigation app',
      grant: {
        may: ['Merge and deploy to the staging beds yourself.'],
        not: [],
        never: [],
        scope: null,
        reading: 'covers garden-api merges and staging deploys',
        where: 'chat',
        set: '2026-03-10T11:43:00Z',
      },
      started: '2026-03-02T08:04:11Z',
      now: 't-valves',
      nowNext: 'wire the relay test',
      nowSet: '2026-03-10T10:43:00Z',
      lastWrite: '2026-03-10T11:43:00Z',
      lastNudge: null,
      importedFrom: null,
    },
    itemIDs: ['ok-wipe', 't-valves', 't-timer', 'r-tests'],
    kept: {
      id: 'ok-wipe',
      kind: 'ok',
      claim: 'you can wipe the staging sensor table once',
      check: null,
      atWrite: null,
      last: null,
      written: '2026-03-05T09:00:00Z',
      by: 'agent',
      extra: { who: 'owner', where: 'chat', scope: 'staging sensor table' },
    },
    notes: [],
    removedNotes: ['ok-merge'],
    journalRows: [
      {
        ts: '2026-03-10T11:43:00Z',
        op: 'drop',
        id: 'ok-merge',
        by: 'agent',
        text: 'merge the garden-api PRs yourself once CI is green',
        why: 'folded into the grant by the format 2 upgrade',
        extra: null,
      },
      {
        ts: '2026-03-10T11:43:00Z',
        op: 'drop',
        id: 'ok-deploy',
        by: 'agent',
        text: 'deploy to the staging beds whenever you need to',
        why: 'folded into the grant by the format 2 upgrade',
        extra: null,
      },
      {
        ts: '2026-03-10T11:43:00Z',
        op: 'grant',
        id: 'grant',
        by: 'agent',
        text: 'may: Merge and deploy to the staging beds yourself.',
        why: 'covers garden-api merges and staging deploys',
        extra: 'where=chat',
      },
      {
        ts: '2026-03-10T11:43:00Z',
        op: 'import',
        id: 'garden-beds',
        by: 'agent',
        text: 'format 1 -> 2',
        why: null,
        extra: null,
      },
    ],
    folded: 2,
    keptCount: 1,
  });
});

test('it writes the grant row by the owner for the owner terminal, then a bind row for the agent', () => {
  const ctx = setupTest();

  const picked = ctx.pickUpgraded(ctx.grantFlags, {
    byOwner: true,
    agent: { harness: 'claude', id: 'a1b2-test' },
  });

  expect(picked.journalRows.map((row) => [row.op, row.by])).toStrictEqual([
    ['drop', 'agent'],
    ['drop', 'agent'],
    ['grant', 'owner'],
    ['import', 'agent'],
    ['bind', 'agent'],
  ]);
});

test('it converts a store with no standing approval to format 2 with no grant', () => {
  const ctx = setupTest();
  const items = ctx.dropLines(ctx.files.items, ['ok-merge', 'ok-deploy']);
  const picked = ctx.pickUpgraded([], { files: { items } });

  expect([
    picked.session.grant,
    picked.folded,
    picked.kept,
    picked.journalRows.map((row) => row.op),
  ]).toStrictEqual([null, 0, 1, ['import']]);
});

test('it clears now when it names a removed item', () => {
  const ctx = setupTest();
  const session = ctx.files.session.replace('now=t-valves', 'now=ok-merge');
  const picked = ctx.pickUpgraded(ctx.grantFlags, { files: { session } });

  expect([picked.session.now, picked.session.nowNext, picked.session.nowSet]).toStrictEqual([
    null,
    null,
    null,
  ]);
});

test('it removes the one-time approval that --drop names, with a drop row of its own', () => {
  const ctx = setupTest();
  const picked = ctx.pickUpgraded([...ctx.grantFlags, '--drop', 'ok-wipe']);

  expect([
    picked.items.map((item) => item.id),
    picked.kept,
    picked.journalRows.filter((row) => row.id === 'ok-wipe').map((row) => row.why),
  ]).toStrictEqual([['t-valves', 't-timer', 'r-tests'], 0, ['dropped by the format 2 upgrade']]);
});

test('it refuses standing approvals with no --may, and its Run line adds the grant flags', () => {
  const ctx = setupTest();

  expect(ctx.readRefusal(ctx.pick([]))).toStrictEqual([
    "www: refused: garden-beds holds 2 standing approvals, and format 2 keeps lasting permission in the grant. Record the owner's words in the same command.",
    '  ok-merge   "merge the garden-api PRs yourself once CI is green" · garden-api',
    '  ok-deploy  "deploy to the staging beds whenever you need to" · staging beds',
    'Run: www import garden-beds --may <what the owner allows, in their words> --may <what the owner allows, in their words> --where chat --reading <what they cover; what the owner kept back>',
  ]);
});

test.each([
  {
    title: 'three one-time approvals',
    argv: [],
    first:
      'www: refused: garden-beds holds 3 one-time approvals, and format 2 holds 1. Drop all but one.',
  },
  {
    title: 'an item named grant',
    argv: [],
    first:
      'www: refused: format 2 keeps the id grant for the grant, and garden-beds has an item grant. Drop it, and write it again under a new id after the upgrade.',
  },
  {
    title: 'a --drop that names no item',
    argv: ['--drop', 'nope'],
    first:
      'www: refused: --drop nope names no item in garden-beds. Items: ok-wipe, t-valves, t-timer, r-tests.',
  },
  {
    title: 'only --may',
    argv: ['--may', 'Go.'],
    first:
      "www: refused: a grant needs at least one --may, --not or --never in the owner's words, where they were given, and your reading of what they cover and what the owner kept back.",
  },
  {
    title: 'standing approvals and only --not',
    argv: ['--not', 'Go.', '--where', 'chat', '--reading', 'r'],
    first:
      "www: refused: garden-beds holds 2 standing approvals, and format 2 keeps lasting permission in the grant. Record the owner's words in the same command.",
  },
  {
    title: 'words of 701 characters across bullets and scope',
    argv: [
      ...Array.from({ length: 5 }, () => ['--may', 'w'.repeat(120)]).flat(),
      '--not',
      'n'.repeat(100),
      '--scope',
      's',
      '--where',
      'chat',
      '--reading',
      'r',
    ],
    first:
      "www: refused: the grant's words are 701 characters in its bullets and scope, and the limit is 700.",
  },
  {
    title: 'a grant of 20 lines in the brief',
    argv: [
      '--may',
      buildSpacedText(649, 74),
      ...Array.from({ length: 11 }, () => ['--may', 'o']).flat(),
      '--where',
      'chat',
      '--reading',
      'r',
    ],
    first:
      'www: refused: the grant takes 20 lines in the brief, and the limit is 19. Join short parts that belong together in one bullet, or put a long part in fewer words.',
  },
  {
    title: '13 bullets',
    argv: [
      ...Array.from({ length: 13 }, () => ['--may', 'water']).flat(),
      '--where',
      'chat',
      '--reading',
      'r',
    ],
    first:
      'www: refused: the grant has 13 bullets, and the limit is 12. Put two parts that belong together in one bullet.',
  },
  {
    title: 'a scope of 41 characters',
    argv: ['--may', 'Go.', '--scope', 's'.repeat(41), '--where', 'chat', '--reading', 'r'],
    first: "www: refused: the grant's scope is 41 characters, and the limit is 40.",
  },
])('it refuses $title, and writes nothing', (row) => {
  const ctx = setupTest();
  const noStanding = ctx.dropLines(ctx.files.items, ['ok-merge', 'ok-deploy']);
  const grantRow = 'grant\ttask\tTidy the beds\t-\t-\t-\t2026-03-09T09:00:00Z\tagent\t-\n';
  const once = ctx.files.items.replaceAll('use=standing', 'use=once');

  const itemsByTitle = {
    'three one-time approvals': once,
    'an item named grant': `${noStanding}${grantRow}`,
    'a --drop that names no item': noStanding,
    'only --may': ctx.files.items,
    'standing approvals and only --not': ctx.files.items,
    'words of 701 characters across bullets and scope': ctx.files.items,
    'a grant of 20 lines in the brief': ctx.files.items,
    '13 bullets': ctx.files.items,
    'a scope of 41 characters': ctx.files.items,
  };

  const picked = ctx.pick(row.argv, { files: { items: itemsByTitle[row.title] } });

  expect(ctx.readRefusal(picked)?.at(0)).toBe(row.first);
});

test('it refuses every problem at once, each with its lines, and one Run line that fixes them', () => {
  const ctx = setupTest();
  const items = `${ctx.files.items}ok-b\tok\tpush the garden-api tags\t-\t-\t-\t2026-03-08T09:00:00Z\tagent\twho=owner;where=chat;scope=garden-api;use=once\ngrant\ttask\tTidy the beds\t-\t-\t-\t2026-03-09T09:00:00Z\tagent\t-\n`;
  const picked = ctx.pick(['--drop', 'nope'], { files: { items } });

  expect(ctx.readRefusal(picked)).toStrictEqual([
    "www: refused: garden-beds holds 2 standing approvals, and format 2 keeps lasting permission in the grant. Record the owner's words in the same command.",
    '  ok-merge   "merge the garden-api PRs yourself once CI is green" · garden-api',
    '  ok-deploy  "deploy to the staging beds whenever you need to" · staging beds',
    'www: refused: garden-beds holds 2 one-time approvals, and format 2 holds 1. Drop all but one.',
    '  ok-wipe  "you can wipe the staging sensor table once" · staging sensor table  [5d]',
    '  ok-b     "push the garden-api tags" · garden-api  [2d]',
    'www: refused: format 2 keeps the id grant for the grant, and garden-beds has an item grant. Drop it, and write it again under a new id after the upgrade.',
    'www: refused: --drop nope names no item in garden-beds. Items: ok-merge, ok-deploy, ok-wipe, t-valves, t-timer, r-tests, ok-b, grant.',
    'Run: www import garden-beds --drop ok-wipe --drop grant --may <what the owner allows, in their words> --may <what the owner allows, in their words> --where chat --reading <what they cover; what the owner kept back>',
  ]);
});

test('it applies no cap of 3 to the items it reads, so a store with four approvals is read', () => {
  const ctx = setupTest();
  const items = `${ctx.files.items}ok-b\tok\tpush the garden-api tags\t-\t-\t-\t2026-03-08T09:00:00Z\tagent\twho=owner;where=chat;scope=garden-api;use=standing\n`;
  const picked = ctx.pickUpgraded(ctx.grantFlags, { files: { items } });

  expect(picked.folded).toBe(3);
});

test('it leaves out a note whose id names no item, as every read of format 1 does', () => {
  const ctx = setupTest();
  const notes = `${ctx.files.notes ?? ''}grant\towed\t2026-03-06T09:00:00Z\tCheck the relay.\nt-gone\t-\t2026-03-06T09:00:00Z\tAn item closed under it.\n`;
  const picked = ctx.pickUpgraded(ctx.grantFlags, { files: { notes } });

  expect([picked.notes, picked.removedNotes.map((note) => note.id)]).toStrictEqual([
    [],
    ['ok-merge'],
  ]);
});

test.each([
  {
    title: 'a journal whose header is broken',
    journal: 'ts\top\tid\n',
    first:
      "www: garden-beds's journal.tsv line 1 does not parse: the header is not the journal header. Fix the row by hand.",
  },
  {
    title: 'a journal with no header',
    journal: '',
    first:
      "www: garden-beds's journal.tsv line 1 does not parse: the header is not the journal header. Fix the row by hand.",
  },
  {
    title: 'a journal with a line that is no row',
    journal:
      'ts\top\tid\tby\ttext\twhy\textra\n2026-03-02T08:04:11Z\tinit\tgarden-beds\tagent\tShip it\t-\t-\nnot a row\n',
    first:
      "www: garden-beds's journal.tsv line 3 does not parse: the line is not a journal row. Fix the row by hand.",
  },
  {
    title: 'a journal whose last line was cut before its newline',
    journal:
      'ts\top\tid\tby\ttext\twhy\textra\n2026-03-02T08:04:11Z\tinit\tgarden-beds\tagent\tShip it\t-\t-\n2026-03-03T09:00:00Z\tnote',
    first:
      "www: garden-beds's journal.tsv line 3 does not parse: the line is not a journal row. Fix the row by hand.",
  },
])('it refuses $title as a broken store, and writes nothing', (row) => {
  const ctx = setupTest();
  const picked = ctx.pick(ctx.grantFlags, { files: { journal: row.journal } });

  expect(ctx.readRefusal(picked)?.at(0)).toBe(row.first);
});

test('it prints no credential from a stored approval or a --drop value, in a line or in the Run line', () => {
  const ctx = setupTest();
  const secret = `AKIA${'Q'.repeat(16)}`;

  const items = ctx.files.items.replace(
    'merge the garden-api PRs yourself once CI is green',
    secret,
  );

  const refused = ctx.readRefusal(ctx.pick(['--drop', secret], { files: { items } }));

  expect(refused).toStrictEqual([
    "www: refused: garden-beds holds 2 standing approvals, and format 2 keeps lasting permission in the grant. Record the owner's words in the same command.",
    '  ok-merge   "<where the secret lives>" · garden-api',
    '  ok-deploy  "deploy to the staging beds whenever you need to" · staging beds',
    'www: refused: --drop <where the secret lives> names no item in garden-beds. Items: ok-merge, ok-deploy, ok-wipe, t-valves, t-timer, r-tests.',
    'Run: www import garden-beds --may <what the owner allows, in their words> --may <what the owner allows, in their words> --where chat --reading <what they cover; what the owner kept back>',
  ]);
});

test('it fixes the bullets and the reading in one Run line when both are over their limits', () => {
  const ctx = setupTest();
  const items = ctx.dropLines(ctx.files.items, ['ok-merge', 'ok-deploy']);

  const picked = ctx.pick(
    [
      ...Array.from({ length: 5 }, () => ['--may', 'w'.repeat(120)]).flat(),
      '--not',
      'n'.repeat(100),
      '--scope',
      's',
      '--where',
      'chat',
      '--reading',
      'r'.repeat(201),
    ],
    { files: { items } },
  );

  expect(ctx.readRefusal(picked)).toStrictEqual([
    "www: refused: the grant's words are 701 characters in its bullets and scope, and the limit is 700.",
    'www: refused: the reading is 201 characters, and the limit is 200.',
    'Run: www import garden-beds --may <what the owner allows, in their words> --not <what the owner did not grant, in their words> --scope s --where chat --reading <reading of at most 200 characters>',
  ]);
});

test('it writes the bullets, the scope and the grant journal row of an upgrade with --may, --not, --never and --scope', () => {
  const ctx = setupTest();

  const picked = ctx.pickUpgraded([
    '--may',
    'Merge the garden-api pull requests yourself.',
    '--may',
    'Deploy to the staging beds.',
    '--not',
    'Wipe the staging sensor table.',
    '--never',
    'Touch the prod beds.',
    '--scope',
    'garden-api and staging',
    '--where',
    'chat',
    '--reading',
    'covers merges and staging deploys',
  ]);

  expect({
    grant: picked.session.grant,
    grantRow: picked.journalRows.find((row) => row.op === 'grant'),
  }).toStrictEqual({
    grant: {
      may: ['Merge the garden-api pull requests yourself.', 'Deploy to the staging beds.'],
      not: ['Wipe the staging sensor table.'],
      never: ['Touch the prod beds.'],
      scope: 'garden-api and staging',
      reading: 'covers merges and staging deploys',
      where: 'chat',
      set: '2026-03-10T11:43:00Z',
    },
    grantRow: {
      ts: '2026-03-10T11:43:00Z',
      op: 'grant',
      id: 'grant',
      by: 'agent',
      text: 'may: Merge the garden-api pull requests yourself. • Deploy to the staging beds. · not: Wipe the staging sensor table. · never: Touch the prod beds. · scope: garden-api and staging',
      why: 'covers merges and staging deploys',
      extra: 'where=chat',
    },
  });
});

test('it refuses a grant of 20 lines with one Run line that replaces its bullets and adds --drop', () => {
  const ctx = setupTest();
  const once = ctx.files.items.replaceAll('use=standing', 'use=once');

  const picked = ctx.pick(
    [
      '--may',
      buildSpacedText(649, 74),
      ...Array.from({ length: 11 }, () => ['--may', 'o']).flat(),
      '--where',
      'chat',
      '--reading',
      'r',
    ],
    { files: { items: once } },
  );

  expect(ctx.readRefusal(picked)).toStrictEqual([
    'www: refused: garden-beds holds 3 one-time approvals, and format 2 holds 1. Drop all but one.',
    '  ok-merge   "merge the garden-api PRs yourself once CI is green" · garden-api  [7d]',
    '  ok-deploy  "deploy to the staging beds whenever you need to" · staging beds  [6d]',
    '  ok-wipe    "you can wipe the staging sensor table once" · staging sensor table  [5d]',
    'www: refused: the grant takes 20 lines in the brief, and the limit is 19. Join short parts that belong together in one bullet, or put a long part in fewer words.',
    'Run: www import garden-beds --may <what the owner allows, in their words> --where chat --reading r --drop ok-merge --drop ok-deploy',
  ]);
});
