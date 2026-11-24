import { expect, test } from 'bun:test';
import { chmodSync, existsSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { waitFor } from '@zgeoff/testing';
import { createTempDir } from '@zgeoff/testing/fs';
import { runCLI } from '../run-cli.ts';
import { withBindingLock } from '../sessions/with-binding-lock.ts';
import { createImportFiles } from '../store/create-import-files.ts';
import { withStoreLock } from '../store/with-store-lock.ts';
import { writeImportFiles } from '../store/write-import-files.ts';
import { writeUpgradeFiles } from '../store/write-upgrade-files.ts';
import { buildFilledRunArgv } from '../test-utils/build-filled-run-argv.ts';
import { buildSpacedText } from '../test-utils/build-spaced-text.ts';
import { buildSteppedImportFiles } from '../test-utils/build-stepped-import-files.ts';
import { readChangedPaths } from '../test-utils/read-changed-paths.ts';
import { readTreeHashes } from '../test-utils/read-tree-hashes.ts';
import { seedFormat1Store } from '../test-utils/seed-format-1-store.ts';
import { seedStaleLock } from '../test-utils/seed-stale-lock.ts';
import { seedStoreFile } from '../test-utils/seed-store-file.ts';

function setupTest() {
  const root = createTempDir('run-import-command').path;
  const stateRoot = join(root, 'wherewerewe');

  return {
    root,
    stateRoot,
    folder: join(stateRoot, 'old-notes'),
    run: (argv: readonly string[], env: Record<string, string | undefined>, nowMs: number) =>
      runCLI({
        argv,
        env,
        cwd: '/work',
        now: () => nowMs,
        terminal: { stdin: false, stdout: false },
      }),
    readTree: () => readTreeHashes(stateRoot),
    readText: (path: string) => readFileSync(join(stateRoot, path), 'utf8'),
  };
}

test('it converts a hand-kept store, keeps the originals, and binds the agent', async () => {
  const ctx = setupTest();
  const nowMs = Date.parse('2026-03-10T11:43:00Z');

  const originals = {
    session:
      'name=old-notes\ngoal=Ship the kiln alerts\nstarted=2026-04-06T09:00:00Z\nnow=t-alerts\nnow_next=write the rule test\nnow_set=2026-04-07T10:15:00Z\nformat=0-by-hand\n',
    items: [
      'id\tkind\tclaim\tcheck\tat_write\tlast\twritten\tby\textra',
      't-alerts\ttask\tAlert rule fires above 1,280 °C\tpr:kilnworks/pottery-app#12\t-\t-\t2026-04-07T10:15:00Z\tagent\tblocked_by=w-probe',
      'w-probe\twait\tthe vendor to confirm the sensor range\t-\t-\t-\t2026-04-06T11:00:00Z\tagent\twho=vendor',
      'ok-push\tok\tpush the alert branches yourself\t-\t-\t-\t2026-04-06T09:05:00Z\tagent\twho=owner;where=terminal;scope=pottery-app branches;standing',
      'r-units\trule\tStore tenths of a degree\t-\t-\t-\t2026-04-06T09:10:00Z\tagent\t-',
      'wh-sim\twhere\tKiln simulator in /srv/kiln-sim\tpath:/srv/kiln-sim\t-\t-\t2026-04-06T09:20:00Z\tagent\t-',
      't-setup\ttask\tSet up the repo\t-\t-\t-\t2026-04-06T09:02:00Z\tagent\t-',
      'ok-once\tok\tmerge the setup PR\t-\t-\t-\t2026-04-06T09:03:00Z\tagent\twho=owner;where=chat;scope=setup PR;once',
      't-spike\ttask\tTry the old probe\t-\t-\t-\t2026-04-06T09:04:00Z\tagent\t-',
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
      '2026-04-07T09:30:00Z\tuse\tok-once\tmerged the setup PR',
      '2026-04-07T09:40:00Z\tdrop\tt-spike\tthe old probe is gone',
    ].join('\n'),
  };

  seedStoreFile(ctx.folder, 'session', originals.session);
  seedStoreFile(ctx.folder, 'items.tsv', `${originals.items}\n`);
  seedStoreFile(ctx.folder, 'journal.tsv', `${originals.journal}\n`);

  const before = await ctx.readTree();

  const result = await ctx.run(
    [
      'import',
      'old-notes',
      '--may',
      'Push the alert branches yourself.',
      '--where',
      'terminal',
      '--reading',
      'covers pushes to the alert branches',
    ],
    { HOME: ctx.root, XDG_STATE_HOME: ctx.root, CLAUDE_CODE_SESSION_ID: 'a1b2-test' },
    nowMs,
  );

  const after = await ctx.readTree();

  expect(result).toStrictEqual({
    exitCode: 0,
    stdout: `Imported old-notes: 5 items, 11 journal rows. Originals in ${ctx.folder}/import-backup/.\n`,
    stderr: '',
  });

  expect({
    files: {
      session: ctx.readText('old-notes/session'),
      items: ctx.readText('old-notes/items.tsv'),
      journal: ctx.readText('old-notes/journal.tsv'),
      owner: ctx.readText('old-notes/owner.tsv'),
      prs: ctx.readText('old-notes/prs.tsv'),
      notes: ctx.readText('old-notes/notes.tsv'),
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
        'format=2\nname=old-notes\ngoal=Ship the kiln alerts\ngrant_may=Push the alert branches yourself.\ngrant_scope=\ngrant_reading=covers pushes to the alert branches\ngrant_where=terminal\ngrant_set=2026-03-10T11:43:00Z\nstarted=2026-04-06T09:00:00Z\nnow=t-alerts\nnow_next=write the rule test\nnow_set=2026-04-07T10:15:00Z\nlast_write=2026-04-07T09:40:00Z\nlast_nudge=\nimported_from=0-by-hand\n',
      items: [
        'id\tkind\tclaim\tcheck\tat_write\tlast\twritten\tby\textra',
        't-alerts\ttask\tAlert rule fires above 1,280 °C\tpr:kilnworks/pottery-app#12\t-\t-\t2026-04-07T10:15:00Z\tagent\tblocked_by=w-probe',
        'w-probe\twait\tthe vendor to confirm the sensor range\t-\t-\t-\t2026-04-06T11:00:00Z\tagent\twho=vendor',
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
        '2026-04-07T09:30:00Z\tuse\tok-once\timport\tmerged the setup PR\t-\t-',
        '2026-04-07T09:40:00Z\tdrop\tt-spike\timport\tthe old probe is gone\t-\t-',
        '2026-03-10T11:43:00Z\tdrop\tok-push\tagent\tpush the alert branches yourself\tfolded into the grant by the format 2 upgrade\t-',
        '2026-03-10T11:43:00Z\tgrant\tgrant\tagent\tmay: Push the alert branches yourself.\tcovers pushes to the alert branches\twhere=terminal',
        '2026-03-10T11:43:00Z\timport\told-notes\tagent\t0-by-hand -> 2\t-\t-',
        '2026-03-10T11:43:00Z\tbind\told-notes\tagent\timport\t-\tharness=claude;agent=a1b2-test',
        '',
      ].join('\n'),
      owner: 'id\ttext\tsaid\ton\n',
      prs: 'ref\topened\tstate\tseen\n',
      notes: 'id\towed\twritten\tnote\n',
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
      'old-notes/notes.tsv',
      'old-notes/owner.tsv',
      'old-notes/prs.tsv',
      'old-notes/session',
    ],
  });
});

test('it makes a store that the brief reads', async () => {
  const ctx = setupTest();
  const nowMs = Date.parse('2026-03-10T11:43:00Z');

  seedStoreFile(
    ctx.folder,
    'session',
    'name=old-notes\ngoal=Ship the kiln alerts\nstarted=2026-03-09T09:00:00Z\n',
  );

  await ctx.run(['import', 'old-notes'], { HOME: ctx.root, XDG_STATE_HOME: ctx.root }, nowMs);

  const brief = await ctx.run(
    ['--session', 'old-notes'],
    { HOME: ctx.root, XDG_STATE_HOME: ctx.root },
    nowMs,
  );

  expect({
    exitCode: brief.exitCode,
    goal: brief.stdout.includes('GOAL  Ship the kiln alerts'),
  }).toStrictEqual({
    exitCode: 0,
    goal: true,
  });
});

test('it converts the store its name gives, whatever --session says', async () => {
  const ctx = setupTest();
  const nowMs = Date.parse('2026-03-10T11:43:00Z');

  seedStoreFile(
    ctx.folder,
    'session',
    'name=old-notes\ngoal=Ship the kiln alerts\nstarted=2026-03-09T09:00:00Z\n',
  );

  seedStoreFile(
    join(ctx.stateRoot, 'other-notes'),
    'session',
    'name=other-notes\ngoal=Ship the glaze list\nstarted=2026-03-09T09:00:00Z\n',
  );

  const before = await ctx.readTree();

  const result = await ctx.run(
    ['import', 'old-notes', '--session', 'other-notes'],
    { HOME: ctx.root, XDG_STATE_HOME: ctx.root },
    nowMs,
  );

  const after = await ctx.readTree();

  expect({ exitCode: result.exitCode, changed: readChangedPaths(before, after) }).toStrictEqual({
    exitCode: 0,
    changed: [
      'old-notes/import-backup/session',
      'old-notes/items.tsv',
      'old-notes/journal.tsv',
      'old-notes/notes.tsv',
      'old-notes/owner.tsv',
      'old-notes/prs.tsv',
      'old-notes/session',
    ],
  });
});

test('it refuses a store with five broken rows, writes nothing, and passes once the rows are fixed', async () => {
  const ctx = setupTest();
  const nowMs = Date.parse('2026-03-10T11:43:00Z');

  seedStoreFile(
    ctx.folder,
    'session',
    'name=old-notes\ngoal=Ship it\nstarted=2026-04-06T09:00:00Z\nnow=t-a\n',
  );

  seedStoreFile(
    ctx.folder,
    'items.tsv',
    [
      'id\tkind\tclaim\tcheck\tat_write\tlast\twritten\tby\textra',
      't-a\ttask\tWrite it\t-\t-\t-\t2026-04-06T09:00:00Z\tagent\t-',
      `t-b\ttask\t${'c'.repeat(121)}\t-\t-\t-\t2026-04-06T09:00:00Z\tagent\t-`,
      'ok-a\tok\tmerge it\t-\t-\t-\t2026-04-06T09:00:00Z\tagent\twho=owner',
      'w-a\twait\tAnswer\t-\t-\t-\t2026-04-06T09:00:00Z\tagent\t-',
      'r-a\trule\tDo it this way\tpid:5\t-\t-\t2026-04-06T09:00:00Z\tagent\t-',
      '',
    ].join('\n'),
  );

  seedStoreFile(
    ctx.folder,
    'journal.tsv',
    `ts\top\tid\ttext\n2026-04-06T09:00:00Z\topen\tq-1\t${'q'.repeat(121)}\n`,
  );

  const before = await ctx.readTree();

  const refused = await ctx.run(
    ['import', 'old-notes'],
    { HOME: ctx.root, XDG_STATE_HOME: ctx.root },
    nowMs,
  );

  const after = await ctx.readTree();

  seedStoreFile(
    ctx.folder,
    'items.tsv',
    'id\tkind\tclaim\tcheck\tat_write\tlast\twritten\tby\textra\nt-a\ttask\tWrite it\t-\t-\t-\t2026-04-06T09:00:00Z\tagent\t-\n',
  );

  seedStoreFile(
    ctx.folder,
    'journal.tsv',
    'ts\top\tid\ttext\n2026-04-06T09:00:00Z\topen\tq-1\tWhich one\n',
  );

  const retried = await ctx.run(
    ['import', 'old-notes'],
    { HOME: ctx.root, XDG_STATE_HOME: ctx.root },
    nowMs,
  );

  expect(refused).toStrictEqual({
    exitCode: 3,
    stdout: '',
    stderr:
      'www: refused: import found 5 rows that break the rules, and wrote nothing.\nitems.tsv line 3 (t-b): the claim is 121 characters, and the limit is 120.\nitems.tsv line 4 (ok-a): an approval needs who, where, scope, and once or standing.\nitems.tsv line 5 (w-a): a wait needs who.\nitems.tsv line 6 (r-a): a rule has no check.\njournal.tsv line 2 (q-1): the question is 121 characters, and the limit is 120 for a wait.\nRun: www import old-notes\n',
  });

  expect(after).toStrictEqual(before);
  expect(retried.exitCode).toBe(0);
});

test('it refuses a hand-kept session with CRLF line endings by its rows, not as a newer format', async () => {
  const ctx = setupTest();
  const nowMs = Date.parse('2026-03-10T11:43:00Z');

  seedStoreFile(
    ctx.folder,
    'session',
    'name=old-notes\r\ngoal=Ship it\r\nstarted=2026-04-06T09:00:00Z\r\nformat=0-by-hand\r\n',
  );

  const before = await ctx.readTree();

  const result = await ctx.run(
    ['import', 'old-notes'],
    { HOME: ctx.root, XDG_STATE_HOME: ctx.root },
    nowMs,
  );

  const after = await ctx.readTree();

  expect({ result, unchanged: after }).toStrictEqual({
    result: {
      exitCode: 3,
      stdout: '',
      stderr:
        'www: refused: import found 4 rows that break the rules, and wrote nothing.\nsession line 1: the line holds a carriage return. Save the file with LF line endings.\nsession line 2: the line holds a carriage return. Save the file with LF line endings.\nsession line 3: the line holds a carriage return. Save the file with LF line endings.\nsession line 4: the line holds a carriage return. Save the file with LF line endings.\nRun: www import old-notes\n',
    },
    unchanged: before,
  });
});

test('it refuses a store that is format 2 already', async () => {
  const ctx = setupTest();
  const env = { HOME: ctx.root, XDG_STATE_HOME: ctx.root };
  const nowMs = Date.parse('2026-03-10T11:43:00Z');

  await ctx.run(['init', 'old-notes', '--goal', 'Ship it'], env, nowMs);

  const before = await ctx.readTree();
  const result = await ctx.run(['import', 'old-notes'], env, nowMs);
  const after = await ctx.readTree();

  expect({ result, unchanged: after }).toStrictEqual({
    result: {
      exitCode: 3,
      stdout: '',
      stderr: 'www: refused: old-notes is already format 2.\nRun: www --session old-notes\n',
    },
    unchanged: before,
  });
});

// A folder where the binding file belongs lets the conversion finish and stops the binding write,
// which renames a temporary file over that path: an import stopped after its last rename.
test('it binds the agent with the Run line of a rerun, after an import stopped before its binding', async () => {
  const ctx = setupTest();
  const env = { HOME: ctx.root, XDG_STATE_HOME: ctx.root, CLAUDE_CODE_SESSION_ID: 'a1b2-test' };
  const nowMs = Date.parse('2026-03-10T11:43:00Z');

  const originals = {
    session: 'name=old-notes\ngoal=Ship it\nstarted=2026-04-06T09:00:00Z\nnow=t-a\n',
    items:
      'id\tkind\tclaim\tcheck\tat_write\tlast\twritten\tby\textra\nt-a\ttask\tWrite it\t-\t-\t-\t2026-04-06T09:00:00Z\tagent\t-\n',
    journal: 'ts\top\tid\ttext\n2026-04-06T09:00:00Z\tinit\told-notes\tStart\n',
  };

  seedStoreFile(ctx.folder, 'session', originals.session);
  seedStoreFile(ctx.folder, 'items.tsv', originals.items);
  seedStoreFile(ctx.folder, 'journal.tsv', originals.journal);
  seedStoreFile(join(ctx.stateRoot, '.bindings', 'claude-a1b2-test'), 'in-the-way', 'x\n');

  await expect(ctx.run(['import', 'old-notes'], env, nowMs)).toReject();

  const stopped = {
    session: ctx.readText('old-notes/session'),
    binding: existsSync(join(ctx.stateRoot, '.bindings', 'claude-a1b2-test', 'in-the-way')),
  };

  rmSync(join(ctx.stateRoot, '.bindings', 'claude-a1b2-test'), { recursive: true });

  await seedStaleLock(ctx.folder);
  await seedStaleLock(join(ctx.stateRoot, '.bindings'));

  const retried = await ctx.run(['import', 'old-notes'], env, nowMs);
  const attached = await ctx.run(['attach', 'old-notes'], env, nowMs);
  const brief = await ctx.run([], env, nowMs);

  expect({
    stopped,
    retried,
    attached,
    briefExitCode: brief.exitCode,
    binding: ctx.readText('.bindings/claude-a1b2-test'),
    backup: [
      ctx.readText('old-notes/import-backup/session'),
      ctx.readText('old-notes/import-backup/items.tsv'),
      ctx.readText('old-notes/import-backup/journal.tsv'),
    ],
    items: ctx.readText('old-notes/items.tsv'),
    lastRows: ctx.readText('old-notes/journal.tsv').trimEnd().split('\n').slice(-3),
  }).toStrictEqual({
    stopped: {
      session: expect.stringContaining('format=2\n'),
      binding: true,
    },
    retried: {
      exitCode: 3,
      stdout: '',
      stderr:
        'www: refused: old-notes is already format 2. Bind this agent session to it.\nRun: www attach old-notes\n',
    },
    attached: {
      exitCode: 0,
      stdout: 'Bound this Claude Code session to old-notes.\n',
      stderr: '',
    },
    briefExitCode: 0,
    binding: 'name=old-notes\n',
    backup: [originals.session, originals.items, originals.journal],
    items:
      'id\tkind\tclaim\tcheck\tat_write\tlast\twritten\tby\textra\nt-a\ttask\tWrite it\t-\t-\t-\t2026-04-06T09:00:00Z\tagent\t-\n',
    lastRows: [
      '2026-03-10T11:43:00Z\timport\told-notes\tagent\t0-by-hand -> 2\t-\t-',
      '2026-03-10T11:43:00Z\tbind\told-notes\tagent\timport\t-\tharness=claude;agent=a1b2-test',
      '2026-03-10T11:43:00Z\tbind\told-notes\tagent\tattach\t-\tharness=claude;agent=a1b2-test',
    ],
  });
});

test('it refuses a format 1 store with a broken session file, and writes nothing', async () => {
  const ctx = setupTest();
  const nowMs = Date.parse('2026-03-10T11:43:00Z');

  seedStoreFile(ctx.folder, 'session', 'format=1\nname=old-notes\nbogus line\n');

  const before = await ctx.readTree();

  const result = await ctx.run(
    ['import', 'old-notes'],
    { HOME: ctx.root, XDG_STATE_HOME: ctx.root },
    nowMs,
  );

  const after = await ctx.readTree();

  expect({ result, unchanged: after }).toStrictEqual({
    result: {
      exitCode: 3,
      stdout: '',
      stderr: `www: old-notes's session does not parse: the line "bogus line" is not key=value. Fix the file by hand.\nRun: less ${ctx.folder}/session\n`,
    },
    unchanged: before,
  });
});

test('it refuses a format 1 store with a broken items file by that file, so its Run line never fails', async () => {
  const ctx = setupTest();
  const env = { HOME: ctx.root, XDG_STATE_HOME: ctx.root, CLAUDE_CODE_SESSION_ID: 'a1b2-test' };
  const nowMs = Date.parse('2026-03-10T11:43:00Z');

  await ctx.run(['init', 'old-notes', '--goal', 'Ship it'], env, nowMs);

  seedStoreFile(
    ctx.folder,
    'items.tsv',
    'id\tkind\tclaim\tcheck\tat_write\tlast\twritten\tby\textra\nt-a\ttask\n',
  );

  const before = await ctx.readTree();
  const result = await ctx.run(['import', 'old-notes'], env, nowMs);
  const after = await ctx.readTree();

  expect({ result, unchanged: after }).toStrictEqual({
    result: {
      exitCode: 3,
      stdout: '',
      stderr: `www: old-notes's items.tsv line 2 does not parse: expected 9 tab-separated columns, found 2. Fix the row by hand.\nRun: less ${ctx.folder}/items.tsv\n`,
    },
    unchanged: before,
  });
});

test.each([
  { title: 'a folder that does not exist', name: 'nope-notes' },
  { title: 'a name that is no session name', name: 'Nope Notes' },
])('it refuses $title, and lists the sessions', async (row) => {
  const ctx = setupTest();
  const env = { HOME: ctx.root, XDG_STATE_HOME: ctx.root };
  const nowMs = Date.parse('2026-03-10T11:43:00Z');

  await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it'], env, nowMs);

  const result = await ctx.run(['import', row.name], env, nowMs);

  expect(result).toStrictEqual({
    exitCode: 3,
    stdout: '',
    stderr: `www: refused: no session folder ${row.name} to import. Sessions: tide-alerts.\nRun: www sessions\n`,
  });
});

test('it refuses a store of a newer format, and writes nothing', async () => {
  const ctx = setupTest();
  const nowMs = Date.parse('2026-03-10T11:43:00Z');

  seedStoreFile(ctx.folder, 'session', 'format=3\n');

  const before = await ctx.readTree();

  const result = await ctx.run(
    ['import', 'old-notes'],
    { HOME: ctx.root, XDG_STATE_HOME: ctx.root },
    nowMs,
  );

  const after = await ctx.readTree();

  expect({ result, unchanged: after }).toStrictEqual({
    result: {
      exitCode: 5,
      stdout: '',
      stderr:
        'www: old-notes is format 3, and this www reads format 2.\nRun: bun add -g @wherewerewe/cli@latest\n',
    },
    unchanged: before,
  });
});

test('it refuses while another write holds the lock, and names the holder', async () => {
  const ctx = setupTest();
  const released = Promise.withResolvers<undefined>();
  const nowMs = Date.parse('2026-03-10T11:43:00Z');

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

  const result = await ctx.run(
    ['import', 'old-notes'],
    { HOME: ctx.root, XDG_STATE_HOME: ctx.root },
    nowMs,
  );

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

test('it refuses while the binding lock is held, and converts nothing', async () => {
  const ctx = setupTest();
  const released = Promise.withResolvers<undefined>();
  const nowMs = Date.parse('2026-03-10T11:43:00Z');

  seedStoreFile(
    ctx.folder,
    'session',
    'name=old-notes\ngoal=Ship it\nstarted=2026-04-06T09:00:00Z\n',
  );

  const holder = withBindingLock(ctx.stateRoot, () => released.promise);

  await waitFor(async () => {
    const tree = await ctx.readTree();

    expect(Object.keys(tree)).toContain('.bindings/lock');
  });

  const before = await ctx.readTree();

  const result = await ctx.run(
    ['import', 'old-notes'],
    { HOME: ctx.root, XDG_STATE_HOME: ctx.root, CLAUDE_CODE_SESSION_ID: 'a1b2-test' },
    nowMs,
  );

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

test('it converts nothing when the binding cannot be written', async () => {
  const ctx = setupTest();
  const nowMs = Date.parse('2026-03-10T11:43:00Z');

  seedStoreFile(
    ctx.folder,
    'session',
    'name=old-notes\ngoal=Ship it\nstarted=2026-04-06T09:00:00Z\n',
  );

  seedStoreFile(ctx.stateRoot, '.bindings', 'a file where the bindings folder belongs\n');

  const before = await ctx.readTree();

  await expect(
    ctx.run(
      ['import', 'old-notes'],
      { HOME: ctx.root, XDG_STATE_HOME: ctx.root, CLAUDE_CODE_SESSION_ID: 'a1b2-test' },
      nowMs,
    ),
  ).toReject();

  const after = await ctx.readTree();

  expect(after).toStrictEqual(before);
});

test.each([
  {
    title: 'import-backup/ complete and the originals in place',
    files: [
      {
        name: 'import-backup/session',
        text: 'name=old-notes\ngoal=Ship it\nstarted=2026-04-06T09:00:00Z\nnow=t-a\n',
      },
      {
        name: 'import-backup/items.tsv',
        text: 'id\tkind\tclaim\tcheck\tat_write\tlast\twritten\tby\textra\nt-a\ttask\tWrite it\t-\t-\t-\t2026-04-06T09:00:00Z\tagent\t-\n',
      },
      {
        name: 'import-backup/journal.tsv',
        text: 'ts\top\tid\ttext\n2026-04-06T09:00:00Z\tinit\told-notes\tStart\n',
      },
    ],
  },
  {
    title:
      'import-backup/ complete, items.tsv and journal.tsv converted, and session still hand-kept',
    files: [
      {
        name: 'import-backup/session',
        text: 'name=old-notes\ngoal=Ship it\nstarted=2026-04-06T09:00:00Z\nnow=t-a\n',
      },
      {
        name: 'import-backup/items.tsv',
        text: 'id\tkind\tclaim\tcheck\tat_write\tlast\twritten\tby\textra\nt-a\ttask\tWrite it\t-\t-\t-\t2026-04-06T09:00:00Z\tagent\t-\n',
      },
      {
        name: 'import-backup/journal.tsv',
        text: 'ts\top\tid\ttext\n2026-04-06T09:00:00Z\tinit\told-notes\tStart\n',
      },
      {
        name: 'items.tsv',
        text: 'id\tkind\tclaim\tcheck\tat_write\tlast\twritten\tby\textra\n',
      },
      { name: 'journal.tsv', text: 'ts\top\tid\tby\ttext\twhy\textra\n' },
      { name: 'owner.tsv', text: 'id\ttext\tsaid\ton\n' },
      { name: 'prs.tsv', text: 'ref\topened\tstate\tseen\n' },
    ],
  },
  {
    title: 'an import-backup.tmp-* folder with only session in it',
    files: [{ name: 'import-backup.tmp-1-abcd/session', text: 'name=old-notes\ngoal=Ship it\n' }],
  },
  {
    title: 'import-backup/ complete and staged files for every new file',
    files: [
      {
        name: 'import-backup/session',
        text: 'name=old-notes\ngoal=Ship it\nstarted=2026-04-06T09:00:00Z\nnow=t-a\n',
      },
      {
        name: 'import-backup/items.tsv',
        text: 'id\tkind\tclaim\tcheck\tat_write\tlast\twritten\tby\textra\nt-a\ttask\tWrite it\t-\t-\t-\t2026-04-06T09:00:00Z\tagent\t-\n',
      },
      {
        name: 'import-backup/journal.tsv',
        text: 'ts\top\tid\ttext\n2026-04-06T09:00:00Z\tinit\told-notes\tStart\n',
      },
      { name: 'owner.tsv.tmp-1-abcd', text: 'id\ttext\tsaid\ton\n' },
      { name: 'prs.tsv.tmp-1-abcd', text: 'ref\topened\tstate\tseen\n' },
      { name: 'items.tsv.tmp-1-abcd', text: 'new items\n' },
      { name: 'journal.tsv.tmp-1-abcd', text: 'new journal\n' },
      { name: 'session.tmp-1-abcd', text: 'format=1\n' },
    ],
  },
  {
    title:
      'the locks a killed import left in the session folder and in .bindings/, import-backup/ complete and items.tsv converted',
    staleLocks: true,
    files: [
      {
        name: 'import-backup/session',
        text: 'name=old-notes\ngoal=Ship it\nstarted=2026-04-06T09:00:00Z\nnow=t-a\n',
      },
      {
        name: 'import-backup/items.tsv',
        text: 'id\tkind\tclaim\tcheck\tat_write\tlast\twritten\tby\textra\nt-a\ttask\tWrite it\t-\t-\t-\t2026-04-06T09:00:00Z\tagent\t-\n',
      },
      {
        name: 'import-backup/journal.tsv',
        text: 'ts\top\tid\ttext\n2026-04-06T09:00:00Z\tinit\told-notes\tStart\n',
      },
      {
        name: 'items.tsv',
        text: 'id\tkind\tclaim\tcheck\tat_write\tlast\twritten\tby\textra\n',
      },
      { name: 'owner.tsv', text: 'id\ttext\tsaid\ton\n' },
      { name: 'prs.tsv', text: 'ref\topened\tstate\tseen\n' },
    ],
  },
])('it ends a restart with $title as a clean import does', async (row) => {
  const clean = setupTest();
  const restart = setupTest();
  const nowMs = Date.parse('2026-03-10T11:43:00Z');

  for (const store of [clean, restart]) {
    seedStoreFile(
      store.folder,
      'session',
      'name=old-notes\ngoal=Ship it\nstarted=2026-04-06T09:00:00Z\nnow=t-a\n',
    );

    seedStoreFile(
      store.folder,
      'items.tsv',
      'id\tkind\tclaim\tcheck\tat_write\tlast\twritten\tby\textra\nt-a\ttask\tWrite it\t-\t-\t-\t2026-04-06T09:00:00Z\tagent\t-\n',
    );

    seedStoreFile(
      store.folder,
      'journal.tsv',
      'ts\top\tid\ttext\n2026-04-06T09:00:00Z\tinit\told-notes\tStart\n',
    );
  }

  for (const file of row.files) {
    const path = join(restart.folder, file.name);

    seedStoreFile(dirname(path), basename(path), file.text);
  }

  if (row.staleLocks === true) {
    await seedStaleLock(restart.folder);
    await seedStaleLock(join(restart.stateRoot, '.bindings'));
  }

  const cleanResult = await clean.run(
    ['import', 'old-notes'],
    { HOME: clean.root, XDG_STATE_HOME: clean.root, CLAUDE_CODE_SESSION_ID: 'a1b2-test' },
    nowMs,
  );

  const result = await restart.run(
    ['import', 'old-notes'],
    { HOME: restart.root, XDG_STATE_HOME: restart.root, CLAUDE_CODE_SESSION_ID: 'a1b2-test' },
    nowMs,
  );

  const cleanTree = await clean.readTree();
  const restartTree = await restart.readTree();

  expect({ result, tree: restartTree }).toStrictEqual({
    result: { ...cleanResult, stdout: cleanResult.stdout.replaceAll(clean.folder, restart.folder) },
    tree: cleanTree,
  });
});

// Stops the import's file writes before each of their 26 calls in turn, from the backup to the last
// rename, then reruns www import on what the stop left on disk.
test.each(Array.from({ length: 26 }, (_value, step) => ({ step })))(
  'it ends a rerun after a stop before file call $step as a clean import does',
  async (row) => {
    const clean = setupTest();
    const restart = setupTest();
    const nowMs = Date.parse('2026-03-10T11:43:00Z');

    const originals = {
      session: 'name=old-notes\ngoal=Ship it\nstarted=2026-04-06T09:00:00Z\nnow=t-a\n',
      items:
        'id\tkind\tclaim\tcheck\tat_write\tlast\twritten\tby\textra\nt-a\ttask\tWrite it\t-\t-\t-\t2026-04-06T09:00:00Z\tagent\t-\n',
      journal: 'ts\top\tid\ttext\n2026-04-06T09:00:00Z\tinit\told-notes\tStart\n',
    };

    for (const store of [clean, restart]) {
      seedStoreFile(store.folder, 'session', originals.session);
      seedStoreFile(store.folder, 'items.tsv', originals.items);
      seedStoreFile(store.folder, 'journal.tsv', originals.journal);
    }

    const cleanResult = await clean.run(
      ['import', 'old-notes'],
      { HOME: clean.root, XDG_STATE_HOME: clean.root, CLAUDE_CODE_SESSION_ID: 'a1b2-test' },
      nowMs,
    );

    expect(() => {
      writeImportFiles(
        restart.folder,
        {
          originals,
          converted: {
            session: clean.readText('old-notes/session'),
            items: clean.readText('old-notes/items.tsv'),
            journal: clean.readText('old-notes/journal.tsv'),
          },
        },
        buildSteppedImportFiles(createImportFiles(), row.step, () => {
          throw new Error('stopped');
        }),
      );
    }).toThrow('stopped');

    await seedStaleLock(restart.folder);

    const result = await restart.run(
      ['import', 'old-notes'],
      { HOME: restart.root, XDG_STATE_HOME: restart.root, CLAUDE_CODE_SESSION_ID: 'a1b2-test' },
      nowMs,
    );

    expect({ result, tree: await restart.readTree() }).toStrictEqual({
      result: {
        ...cleanResult,
        stdout: cleanResult.stdout.replaceAll(clean.folder, restart.folder),
      },
      tree: await clean.readTree(),
    });
  },
);

test('it leaves an owner.tsv that exists alone, and the brief shows its row', async () => {
  const ctx = setupTest();
  const nowMs = Date.parse('2026-03-10T11:43:00Z');
  const env = { HOME: ctx.root, XDG_STATE_HOME: ctx.root, CLAUDE_CODE_SESSION_ID: 'a1b2-test' };
  const ownerPath = join(ctx.folder, 'owner.tsv');

  seedStoreFile(
    ctx.folder,
    'session',
    'name=old-notes\ngoal=Ship the kiln alerts\nstarted=2026-03-09T09:00:00Z\n',
  );

  seedStoreFile(
    ctx.folder,
    'items.tsv',
    'id\tkind\tclaim\tcheck\tat_write\tlast\twritten\tby\textra\n',
  );

  seedStoreFile(
    ctx.folder,
    'journal.tsv',
    'ts\top\tid\ttext\n2026-03-09T09:00:00Z\tinit\told-notes\tShip the kiln alerts\n',
  );

  seedStoreFile(
    ctx.folder,
    'owner.tsv',
    'id\ttext\tsaid\ton\no-1\tAsk me first\t2026-03-09T09:30:00Z\t-\n',
  );

  chmodSync(ownerPath, 0o444);

  const before = statSync(ownerPath);
  const beforeText = readFileSync(ownerPath, 'utf8');

  const imported = await ctx.run(['import', 'old-notes'], env, nowMs);
  const brief = await ctx.run(['--session', 'old-notes'], env, nowMs);

  const after = statSync(ownerPath);

  expect({
    exitCode: imported.exitCode,
    ino: after.ino,
    mode: after.mode & 0o777,
    text: readFileSync(ownerPath, 'utf8'),
    briefSection: brief.stdout.split('\n').filter((line) => /^OWNER SAYS|^ {2}o-1 /u.test(line)),
  }).toStrictEqual({
    exitCode: 0,
    ino: before.ino,
    mode: 0o444,
    text: beforeText,
    briefSection: [
      'OWNER SAYS (1) · act on it; only the owner clears it',
      '  o-1  Ask me first  [26h]',
    ],
  });
});

test('it refuses a format 1 store with two standing and two one-time approvals, changes nothing, and its Run line upgrades it', async () => {
  const ctx = setupTest();
  const env = { HOME: ctx.root, XDG_STATE_HOME: ctx.root, CLAUDE_CODE_SESSION_ID: 'a1b2-test' };
  const nowMs = Date.parse('2026-03-10T11:43:00Z');

  seedFormat1Store(ctx.stateRoot, 'old-notes');

  // four approvals pass the cap of 3 that format 1 writes enforce, so the commands cannot make this
  seedStoreFile(
    ctx.folder,
    'items.tsv',
    `${ctx.readText('old-notes/items.tsv')}ok-tags\tok\tpush the garden-api tags\t-\t-\t-\t2026-03-08T09:00:00Z\tagent\twho=owner;where=chat;scope=garden-api;use=once\n`,
  );

  const formatOneFiles = ['session', 'items.tsv', 'notes.tsv', 'journal.tsv'];
  const originals = formatOneFiles.map((file) => ctx.readText(`old-notes/${file}`));

  const before = await ctx.readTree();

  const listing = readdirSync(ctx.folder).toSorted();

  const refused = await ctx.run(['import', 'old-notes'], env, nowMs);
  const after = await ctx.readTree();

  const runLine = refused.stderr.split('\n').find((line) => line.startsWith('Run: www'));

  expect({
    exitCode: refused.exitCode,
    problems: refused.stderr.split('\n').filter((line) => line.startsWith('www: refused')),
    runCount: refused.stderr.split('\n').filter((line) => line.startsWith('Run: ')).length,
    unchanged: after,
    sameListing: readdirSync(ctx.folder).toSorted(),
  }).toStrictEqual({
    exitCode: 3,
    problems: [
      "www: refused: old-notes holds 2 standing approvals, and format 2 keeps lasting permission in the grant. Record the owner's words in the same command.",
      'www: refused: old-notes holds 2 one-time approvals, and format 2 holds 1. Drop all but one.',
    ],
    runCount: 1,
    unchanged: before,
    sameListing: listing,
  });

  const filled = buildFilledRunArgv(runLine ?? '', {
    '<what the owner allows, in their words>': 'Merge and deploy to the staging beds yourself.',
    '<what they cover; what the owner kept back>': 'covers garden-api merges and staging deploys',
  });

  const upgraded = await ctx.run(filled, env, nowMs);
  const rerun = await ctx.run(['import', 'old-notes'], env, nowMs);

  expect({
    upgraded,
    backup: formatOneFiles.map((file) => ctx.readText(`old-notes/format-1-backup/${file}`)),
    session: ctx.readText('old-notes/session').split('\n').slice(0, 8),
    itemIDs: ctx
      .readText('old-notes/items.tsv')
      .split('\n')
      .slice(1, -1)
      .map((line) => line.split('\t').at(0)),
    binding: ctx.readText('.bindings/claude-a1b2-test'),
    rerun,
  }).toStrictEqual({
    upgraded: {
      exitCode: 0,
      stdout: `Upgraded old-notes to format 2: grant 46 of 700 characters, 2 standing approvals folded into it, 1 one-time approval kept. Originals in ${ctx.folder}/format-1-backup/.\n  ok-merge had a note: Turn the staging pump flag back off before merging the pump change.\n`,
      stderr: '',
    },
    backup: originals,
    session: [
      'format=2',
      'name=old-notes',
      'goal=Ship soil-moisture alerts for the garden irrigation app',
      'grant_may=Merge and deploy to the staging beds yourself.',
      'grant_scope=',
      'grant_reading=covers garden-api merges and staging deploys',
      'grant_where=chat',
      'grant_set=2026-03-10T11:43:00Z',
    ],
    itemIDs: ['t-valves', 't-timer', 'r-tests', 'ok-tags'],
    binding: 'name=old-notes\n',
    rerun: {
      exitCode: 3,
      stdout: '',
      stderr:
        'www: refused: old-notes is already format 2. Bind this agent session to it.\nRun: www attach old-notes\n',
    },
  });
});

test('it finishes a stopped upgrade from format-1-backup/ into the store a clean run makes, with no journal row twice', async () => {
  const ctx = setupTest();
  const clean = setupTest();
  const nowMs = Date.parse('2026-03-10T11:43:00Z');

  const argv = [
    'import',
    'old-notes',
    '--may',
    'Merge and deploy to the staging beds yourself.',
    '--where',
    'chat',
    '--reading',
    'covers garden-api merges and staging deploys',
  ];

  seedFormat1Store(ctx.stateRoot, 'old-notes');
  seedFormat1Store(clean.stateRoot, 'old-notes');

  const cleanResult = await clean.run(
    argv,
    { HOME: clean.root, XDG_STATE_HOME: clean.root },
    nowMs,
  );

  // the process ended after it renamed journal.tsv and items.tsv, and before notes.tsv and session
  const files = createImportFiles();

  expect(() => {
    writeUpgradeFiles(
      ctx.folder,
      {
        session: clean.readText('old-notes/session'),
        items: clean.readText('old-notes/items.tsv'),
        notes: clean.readText('old-notes/notes.tsv'),
        journal: clean.readText('old-notes/journal.tsv'),
      },
      {
        ...files,
        rename: (from, to) => {
          if (basename(to) === 'notes.tsv') {
            throw new Error('stopped');
          }

          files.rename(from, to);
        },
      },
    );
  }).toThrow('stopped');

  const rerun = await ctx.run(argv, { HOME: ctx.root, XDG_STATE_HOME: ctx.root }, nowMs);

  expect({ rerun, tree: await readTreeHashes(ctx.folder) }).toStrictEqual({
    rerun: {
      ...cleanResult,
      stdout: cleanResult.stdout.replaceAll(clean.folder, ctx.folder),
    },
    tree: await readTreeHashes(clean.folder),
  });
});

test('it upgrades a format 1 store with --may, --not, --never and --scope, and writes the bullet lines and the grant journal row', async () => {
  const ctx = setupTest();
  const nowMs = Date.parse('2026-03-10T11:43:00Z');

  seedFormat1Store(ctx.stateRoot, 'old-notes');

  const upgraded = await ctx.run(
    [
      'import',
      'old-notes',
      '--may',
      'water the beds',
      '--may',
      'mow the lawn',
      '--not',
      'prune the roses',
      '--never',
      'dig up the roses',
      '--scope',
      'garden-api',
      '--where',
      'chat',
      '--reading',
      'covers watering and mowing',
    ],
    { HOME: ctx.root, XDG_STATE_HOME: ctx.root },
    nowMs,
  );

  const journal = ctx.readText('old-notes/journal.tsv').split('\n');

  expect({
    firstLine: upgraded.stdout.split('\n').at(0),
    exitCode: upgraded.exitCode,
    session: ctx.readText('old-notes/session').split('\n').slice(0, 11),
    grantRow: journal.find((line) => line.includes('\tgrant\tgrant\t')),
  }).toStrictEqual({
    firstLine: `Upgraded old-notes to format 2: grant 67 of 700 characters, 2 standing approvals folded into it, 1 one-time approval kept. Originals in ${ctx.folder}/format-1-backup/.`,
    exitCode: 0,
    session: [
      'format=2',
      'name=old-notes',
      'goal=Ship soil-moisture alerts for the garden irrigation app',
      'grant_may=water the beds',
      'grant_may=mow the lawn',
      'grant_not=prune the roses',
      'grant_never=dig up the roses',
      'grant_scope=garden-api',
      'grant_reading=covers watering and mowing',
      'grant_where=chat',
      'grant_set=2026-03-10T11:43:00Z',
    ],
    grantRow:
      '2026-03-10T11:43:00Z\tgrant\tgrant\tagent\tmay: water the beds • mow the lawn · not: prune the roses · never: dig up the roses · scope: garden-api\tcovers watering and mowing\twhere=chat',
  });
});

test('it refuses an upgrade with a grant of 20 lines and one Run line that fixes it and drops the extra one-time approvals', async () => {
  const ctx = setupTest();
  const nowMs = Date.parse('2026-03-10T11:43:00Z');
  const env = { HOME: ctx.root, XDG_STATE_HOME: ctx.root };

  seedFormat1Store(ctx.stateRoot, 'old-notes');

  seedStoreFile(
    ctx.folder,
    'items.tsv',
    `${ctx.readText('old-notes/items.tsv')}ok-tags\tok\tpush the garden-api tags\t-\t-\t-\t2026-03-08T09:00:00Z\tagent\twho=owner;where=chat;scope=garden-api;use=once\n`,
  );

  const refused = await ctx.run(
    [
      'import',
      'old-notes',
      '--may',
      buildSpacedText(649, 74),
      ...Array.from({ length: 11 }, () => ['--may', 'o']).flat(),
      '--where',
      'chat',
      '--reading',
      'covers watering',
    ],
    env,
    nowMs,
  );

  const runLine = refused.stderr.split('\n').find((line) => line.startsWith('Run: www'));

  const filled = buildFilledRunArgv(runLine ?? '', {
    '<what the owner allows, in their words>': 'water the beds',
  });

  const upgraded = await ctx.run(filled, env, nowMs);

  expect({
    exitCode: refused.exitCode,
    runLine,
    upgradedExit: upgraded.exitCode,
    session: ctx.readText('old-notes/session').split('\n').slice(3, 6),
  }).toStrictEqual({
    exitCode: 3,
    runLine:
      'Run: www import old-notes --may "<what the owner allows, in their words>" --where chat --reading "covers watering" --drop ok-wipe',
    upgradedExit: 0,
    session: ['grant_may=water the beds', 'grant_scope=', 'grant_reading=covers watering'],
  });
});

test.each([
  {
    title: '12 bullets',
    bullets: Array.from({ length: 12 }, () => 'hold'),
  },
  {
    title: '700 characters of words',
    bullets: [...Array.from({ length: 6 }, () => 'h'.repeat(100)), 'h'.repeat(87)],
  },
  {
    title: '19 lines of the brief',
    bullets: [buildSpacedText(649, 74), ...Array.from({ length: 10 }, () => 'o')],
  },
])(
  'it refuses standing approvals and $title of --not with the needs-grant lines, and a Run line that runs',
  async (row) => {
    const ctx = setupTest();
    const nowMs = Date.parse('2026-03-10T11:43:00Z');
    const env = { HOME: ctx.root, XDG_STATE_HOME: ctx.root };

    seedFormat1Store(ctx.stateRoot, 'old-notes');

    const refused = await ctx.run(
      [
        'import',
        'old-notes',
        ...row.bullets.flatMap((bullet) => ['--not', bullet]),
        '--scope',
        'in garden-api',
        '--where',
        'chat',
        '--reading',
        'covers nothing yet',
      ],
      env,
      nowMs,
    );

    const lines = refused.stderr.split('\n');
    const runLine = lines.find((line) => line.startsWith('Run: www'));

    const filled = buildFilledRunArgv(runLine ?? '', {
      '<what the owner allows, in their words>': 'water the beds',
      '<what the owner did not grant, in their words>': 'replant the north beds',
    });

    const upgraded = await ctx.run(filled, env, nowMs);

    expect({
      exitCode: refused.exitCode,
      problems: lines.filter((line) => line.startsWith('www: refused')),
      approvalLines: lines.filter((line) => line.startsWith('  ok-')).length,
      runLine,
      upgradedExit: upgraded.exitCode,
    }).toStrictEqual({
      exitCode: 3,
      problems: [
        "www: refused: old-notes holds 2 standing approvals, and format 2 keeps lasting permission in the grant. Record the owner's words in the same command.",
      ],
      approvalLines: 2,
      runLine:
        'Run: www import old-notes --not "<what the owner did not grant, in their words>" --scope "in garden-api" --where chat --reading "covers nothing yet" --may "<what the owner allows, in their words>"',
      upgradedExit: 0,
    });
  },
);
