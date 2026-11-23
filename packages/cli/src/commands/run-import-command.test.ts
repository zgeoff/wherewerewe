import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { waitFor } from '@zgeoff/testing';
import { createTempDir } from '@zgeoff/testing/fs';
import { runCLI } from '../run-cli.ts';
import { withStoreLock } from '../store/with-store-lock.ts';
import { readChangedPaths } from '../test-utils/read-changed-paths.ts';
import { readTreeHashes } from '../test-utils/read-tree-hashes.ts';
import { seedStoreFile } from '../test-utils/seed-store-file.ts';

function setupTest() {
  const itemsHead = 'id\tkind\tclaim\tcheck\tat_write\tlast\twritten\tby\textra';
  const root = createTempDir('run-import-command').path;
  const stateRoot = join(root, 'wherewerewe');
  const agentEnv = { XDG_STATE_HOME: root, CLAUDE_CODE_SESSION_ID: 'a1b2-test' };
  const clock = { nowMs: Date.parse('2026-03-10T11:43:00Z') };

  return {
    stateRoot,
    folder: join(stateRoot, 'old-notes'),
    agentEnv,
    run: (argv: readonly string[], env: Record<string, string | undefined> = agentEnv) =>
      runCLI({
        argv,
        env,
        cwd: '/work',
        now: () => {
          clock.nowMs += 1000;

          return clock.nowMs - 1000;
        },
      }),
    itemsHead,
    originalSession: 'name=old-notes\ngoal=Ship it\nstarted=2026-04-06T09:00:00Z\nnow=t-a\n',
    originalItems: `${itemsHead}\nt-a\ttask\tWrite it\t-\t-\t-\t2026-04-06T09:00:00Z\tagent\t-\n`,
    originalJournal: 'ts\top\tid\ttext\n2026-04-06T09:00:00Z\tinit\told-notes\tStart\n',
    readTree: () => readTreeHashes(stateRoot),
    readText: (path: string) => readFileSync(join(stateRoot, path), 'utf8'),
  };
}

test('it converts a hand-kept store, keeps the originals, and binds the agent', async () => {
  const ctx = setupTest();

  const originals = {
    session:
      'name=old-notes\ngoal=Ship the kiln alerts\nstarted=2026-04-06T09:00:00Z\nnow=t-alerts\nnow_next=write the rule test\nnow_set=2026-04-07T10:15:00Z\nformat=0-by-hand\n',
    items: [
      ctx.itemsHead,
      't-alerts\ttask\tAlert rule fires above 1,280 °C\tpr:kilnworks/pottery-app#12\t-\t-\t2026-04-07T10:15:00Z\tagent\tblocked_by=w-probe',
      'w-probe\twait\tthe vendor to confirm the sensor range\t-\t-\t-\t2026-04-06T11:00:00Z\tagent\twho=vendor',
      'ok-push\tok\tpush the alert branches yourself\t-\t-\t-\t2026-04-06T09:05:00Z\tagent\twho=owner;where=terminal;scope=pottery-app branches;standing',
      'r-units\trule\tStore tenths of a degree\t-\t-\t-\t2026-04-06T09:10:00Z\tagent\t-',
      'wh-sim\twhere\tKiln simulator in /srv/kiln-sim\tpath:/srv/kiln-sim\t-\t-\t2026-04-06T09:20:00Z\tagent\t-',
      't-setup\ttask\tSet up the repo\t-\t-\t-\t2026-04-06T09:02:00Z\tagent\t-',
    ].join('\n'),
    journal: [
      'ts\top\tid\ttext',
      '2026-04-06T09:00:00Z\tinit\told-notes\tShip the kiln alerts',
      '2026-04-06T09:12:00Z\tdecide\td-1\tAlerts fire from the job | why: it already reads the probe',
      '2026-04-06T09:40:00Z\topen\tq-1\tWhich kilns first',
      '2026-04-06T09:45:00Z\topen\tq-2\tDoes the vendor report tenths',
      '2026-04-06T10:00:00Z\tclosed\tq-2\tYes: tenths',
      '2026-04-06T10:05:00Z\tnote\tn-1\tThe simulator needs PORT=8091',
      '2026-04-06T10:30:00Z\tsay\to-1\towner: keep the copy short',
      '2026-04-07T08:00:00Z\tdone\tt-setup\trepo set up',
      '2026-04-07T09:00:00Z\tok\tok-push\towner approved pushes',
    ].join('\n'),
  };

  seedStoreFile(ctx.folder, 'session', originals.session);
  seedStoreFile(ctx.folder, 'items.tsv', `${originals.items}\n`);
  seedStoreFile(ctx.folder, 'journal.tsv', `${originals.journal}\n`);

  const before = await ctx.readTree();
  const result = await ctx.run(['import', 'old-notes']);
  const after = await ctx.readTree();

  expect(result).toStrictEqual({
    exitCode: 0,
    stdout: `Imported old-notes: 6 items, 9 journal rows. Originals in ${ctx.folder}/import-backup/.\n`,
    stderr: '',
  });

  expect({
    files: {
      session: ctx.readText('old-notes/session'),
      items: ctx.readText('old-notes/items.tsv'),
      journal: ctx.readText('old-notes/journal.tsv'),
      owner: ctx.readText('old-notes/owner.tsv'),
      prs: ctx.readText('old-notes/prs.tsv'),
      binding: ctx.readText('.bindings/claude-a1b2-test'),
    },
    backup: [
      ctx.readText('old-notes/import-backup/session'),
      ctx.readText('old-notes/import-backup/items.tsv'),
      ctx.readText('old-notes/import-backup/journal.tsv'),
    ],
    changed: readChangedPaths(before, after),
  }).toStrictEqual({
    files: {
      session:
        'format=1\nname=old-notes\ngoal=Ship the kiln alerts\nstarted=2026-04-06T09:00:00Z\nnow=t-alerts\nnow_next=write the rule test\nnow_set=2026-04-07T10:15:00Z\nlast_write=2026-04-07T09:00:00Z\nlast_nudge=\nimported_from=0-by-hand\n',
      items: [
        ctx.itemsHead,
        't-alerts\ttask\tAlert rule fires above 1,280 °C\tpr:kilnworks/pottery-app#12\t-\t-\t2026-04-07T10:15:00Z\tagent\tblocked_by=w-probe',
        'w-probe\twait\tthe vendor to confirm the sensor range\t-\t-\t-\t2026-04-06T11:00:00Z\tagent\twho=vendor',
        'ok-push\tok\tpush the alert branches yourself\t-\t-\t-\t2026-04-06T09:05:00Z\tagent\twho=owner;where=terminal;scope=pottery-app branches;use=standing',
        'r-units\trule\tStore tenths of a degree\t-\t-\t-\t2026-04-06T09:10:00Z\tagent\t-',
        'wh-sim\twhere\tKiln simulator in /srv/kiln-sim\tpath:/srv/kiln-sim\t-\t-\t2026-04-06T09:20:00Z\tagent\t-',
        'q-1\twait\tWhich kilns first\t-\t-\t-\t2026-04-06T09:40:00Z\timport\twho=owner',
        '',
      ].join('\n'),
      journal: [
        'ts\top\tid\tby\ttext\twhy\textra',
        '2026-04-06T09:00:00Z\tinit\told-notes\timport\tShip the kiln alerts\t-\t-',
        '2026-04-06T09:12:00Z\tdecide\td-1\timport\tAlerts fire from the job\tit already reads the probe\t-',
        '2026-04-06T09:40:00Z\twait\tq-1\timport\tWhich kilns first\t-\twho=owner',
        '2026-04-06T09:45:00Z\twait\tq-2\timport\tDoes the vendor report tenths\t-\twho=owner',
        '2026-04-06T10:00:00Z\tdone\tq-2\timport\tDoes the vendor report tenths\tYes: tenths\t-',
        '2026-04-06T10:05:00Z\tnote\tn-1\timport\tThe simulator needs PORT=8091\t-\t-',
        '2026-04-06T10:30:00Z\tsay\to-1\timport\towner: keep the copy short\t-\t-',
        '2026-04-07T08:00:00Z\tdone\tt-setup\timport\trepo set up\t-\t-',
        '2026-04-07T09:00:00Z\tok\tok-push\timport\towner approved pushes\t-\t-',
        '2026-03-10T11:43:00Z\timport\told-notes\tagent\t0-by-hand -> 1\t-\t-',
        '2026-03-10T11:43:00Z\tbind\told-notes\tagent\timport\t-\tharness=claude;agent=a1b2-test',
        '',
      ].join('\n'),
      owner: 'id\ttext\tsaid\ton\n',
      prs: 'ref\topened\tstate\tseen\n',
      binding: 'name=old-notes\n',
    },
    backup: [originals.session, `${originals.items}\n`, `${originals.journal}\n`],
    changed: [
      '.bindings/claude-a1b2-test',
      'old-notes/import-backup/items.tsv',
      'old-notes/import-backup/journal.tsv',
      'old-notes/import-backup/session',
      'old-notes/items.tsv',
      'old-notes/journal.tsv',
      'old-notes/owner.tsv',
      'old-notes/prs.tsv',
      'old-notes/session',
    ],
  });
});

test('it makes a store that the brief reads', async () => {
  const ctx = setupTest();

  seedStoreFile(
    ctx.folder,
    'session',
    'name=old-notes\ngoal=Ship the kiln alerts\nstarted=2026-03-09T09:00:00Z\n',
  );

  await ctx.run(['import', 'old-notes']);

  const brief = await ctx.run(['--session', 'old-notes']);

  expect({
    exitCode: brief.exitCode,
    goal: brief.stdout.includes('GOAL  Ship the kiln alerts'),
  }).toStrictEqual({
    exitCode: 0,
    goal: true,
  });
});

test('it refuses a store with five broken rows, writes nothing, and passes once the rows are fixed', async () => {
  const ctx = setupTest();
  const session = 'name=old-notes\ngoal=Ship it\nstarted=2026-04-06T09:00:00Z\nnow=t-a\n';

  const brokenItems = [
    ctx.itemsHead,
    't-a\ttask\tWrite it\t-\t-\t-\t2026-04-06T09:00:00Z\tagent\t-',
    `t-b\ttask\t${'c'.repeat(121)}\t-\t-\t-\t2026-04-06T09:00:00Z\tagent\t-`,
    'ok-a\tok\tmerge it\t-\t-\t-\t2026-04-06T09:00:00Z\tagent\twho=owner',
    'w-a\twait\tAnswer\t-\t-\t-\t2026-04-06T09:00:00Z\tagent\t-',
    'r-a\trule\tDo it this way\tpid:5\t-\t-\t2026-04-06T09:00:00Z\tagent\t-',
  ].join('\n');

  seedStoreFile(ctx.folder, 'session', session);
  seedStoreFile(ctx.folder, 'items.tsv', `${brokenItems}\n`);

  seedStoreFile(
    ctx.folder,
    'journal.tsv',
    `ts\top\tid\ttext\n2026-04-06T09:00:00Z\topen\tq-1\t${'q'.repeat(121)}\n`,
  );

  const before = await ctx.readTree();
  const refused = await ctx.run(['import', 'old-notes']);
  const after = await ctx.readTree();

  seedStoreFile(
    ctx.folder,
    'items.tsv',
    `${ctx.itemsHead}\nt-a\ttask\tWrite it\t-\t-\t-\t2026-04-06T09:00:00Z\tagent\t-\n`,
  );

  seedStoreFile(
    ctx.folder,
    'journal.tsv',
    'ts\top\tid\ttext\n2026-04-06T09:00:00Z\topen\tq-1\tWhich one\n',
  );

  const retried = await ctx.run(['import', 'old-notes']);

  expect(refused).toStrictEqual({
    exitCode: 3,
    stdout: '',
    stderr:
      'www: refused: import found 5 rows that break the rules, and wrote nothing.\nitems.tsv line 3 (t-b): the claim is 121 characters, and the limit is 120.\nitems.tsv line 4 (ok-a): an approval needs who, where, scope, and once or standing.\nitems.tsv line 5 (w-a): a wait needs who.\nitems.tsv line 6 (r-a): a rule has no check.\njournal.tsv line 2 (q-1): the question is 121 characters, and the limit is 120 for a wait.\nRun: www import old-notes\n',
  });

  expect(after).toStrictEqual(before);
  expect(retried.exitCode).toBe(0);
});

test('it refuses a store that is format 1 already', async () => {
  const ctx = setupTest();

  await ctx.run(['init', 'old-notes', '--goal', 'Ship it']);

  const before = await ctx.readTree();
  const result = await ctx.run(['import', 'old-notes']);
  const after = await ctx.readTree();

  expect({ result, unchanged: after }).toStrictEqual({
    result: {
      exitCode: 3,
      stdout: '',
      stderr: 'www: refused: old-notes is already format 1.\nRun: www --session old-notes\n',
    },
    unchanged: before,
  });
});

test.each([
  { title: 'a folder that does not exist', name: 'nope-notes' },
  { title: 'a name that is no session name', name: 'Nope Notes' },
])('it refuses $title, and lists the sessions', async (row) => {
  const ctx = setupTest();

  await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);

  const result = await ctx.run(['import', row.name]);

  expect(result).toStrictEqual({
    exitCode: 3,
    stdout: '',
    stderr: `www: refused: no session folder ${row.name} to import. Sessions: tide-alerts.\nRun: www sessions\n`,
  });
});

test('it refuses a store of a newer format, and writes nothing', async () => {
  const ctx = setupTest();

  seedStoreFile(ctx.folder, 'session', 'format=2\n');

  const before = await ctx.readTree();
  const result = await ctx.run(['import', 'old-notes']);
  const after = await ctx.readTree();

  expect({ result, unchanged: after }).toStrictEqual({
    result: {
      exitCode: 5,
      stdout: '',
      stderr:
        'www: old-notes is format 2, and this www reads format 1.\nRun: bun add -g @wherewerewe/cli@latest\n',
    },
    unchanged: before,
  });
});

test('it refuses while another write holds the lock, and names the holder', async () => {
  const ctx = setupTest();
  const released = Promise.withResolvers<undefined>();

  seedStoreFile(
    ctx.folder,
    'session',
    'name=old-notes\ngoal=Ship it\nstarted=2026-04-06T09:00:00Z\n',
  );

  const holder = withStoreLock(ctx.folder, () => released.promise);

  await waitFor(async () => {
    const tree = await ctx.readTree();

    expect(Object.keys(tree)).toContain('old-notes/lock');
  });

  const before = await ctx.readTree();
  const result = await ctx.run(['import', 'old-notes']);
  const after = await ctx.readTree();

  released.resolve(undefined);

  await holder;

  expect({ result, unchanged: after }).toStrictEqual({
    result: {
      exitCode: 3,
      stdout: '',
      stderr: `www: refused: another write holds the lock on old-notes (pid ${String(process.pid)}). Try again.\nRun: www import old-notes\n`,
    },
    unchanged: before,
  });
});

type TestContext = ReturnType<typeof setupTest>;

test.each([
  {
    title: 'import-backup/ complete and the originals in place',
    files: (ctx: TestContext) => [
      { name: 'import-backup/session', text: ctx.originalSession },
      { name: 'import-backup/items.tsv', text: ctx.originalItems },
      { name: 'import-backup/journal.tsv', text: ctx.originalJournal },
    ],
  },
  {
    title:
      'import-backup/ complete, items.tsv and journal.tsv converted, and session still hand-kept',
    files: (ctx: TestContext) => [
      { name: 'import-backup/session', text: ctx.originalSession },
      { name: 'import-backup/items.tsv', text: ctx.originalItems },
      { name: 'import-backup/journal.tsv', text: ctx.originalJournal },
      { name: 'items.tsv', text: `${ctx.itemsHead}\n` },
      { name: 'journal.tsv', text: 'ts\top\tid\tby\ttext\twhy\textra\n' },
      { name: 'owner.tsv', text: 'id\ttext\tsaid\ton\n' },
      { name: 'prs.tsv', text: 'ref\topened\tstate\tseen\n' },
    ],
  },
  {
    title: 'an import-backup.tmp-* folder with only session in it',
    files: (ctx: TestContext) => [
      { name: 'import-backup.tmp-1-abcd/session', text: ctx.originalSession },
    ],
  },
])('it ends a restart with $title as a clean import does', async (row) => {
  const clean = setupTest();
  const restart = setupTest();

  for (const store of [clean, restart]) {
    seedStoreFile(store.folder, 'session', store.originalSession);
    seedStoreFile(store.folder, 'items.tsv', store.originalItems);
    seedStoreFile(store.folder, 'journal.tsv', store.originalJournal);
  }

  for (const file of row.files(restart)) {
    const path = join(restart.folder, file.name);

    seedStoreFile(dirname(path), basename(path), file.text);
  }

  const cleanResult = await clean.run(['import', 'old-notes']);
  const result = await restart.run(['import', 'old-notes']);
  const cleanTree = await clean.readTree();
  const restartTree = await restart.readTree();

  expect({ result, tree: restartTree }).toStrictEqual({
    result: { ...cleanResult, stdout: cleanResult.stdout.replaceAll(clean.folder, restart.folder) },
    tree: cleanTree,
  });
});
