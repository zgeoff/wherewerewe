import { expect, test } from 'bun:test';
import { appendFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { createTestHome } from './test-utils/create-test-home.ts';

async function setupTest() {
  const home = createTestHome();

  await home.www(['init', 'tide', '--goal', 'Ship the tide alerts']);

  return home;
}

test('it writes a row with any label and gives it the next id of that label', async () => {
  const ctx = await setupTest();
  const first = await ctx.json(['harbour', 'The north wall floods first']);
  const second = await ctx.json(['harbour', 'The south wall holds']);

  expect([first, second]).toStrictEqual([
    [{ ok: true, id: 'harbour-1', label: 'harbour' }],
    [{ ok: true, id: 'harbour-2', label: 'harbour' }],
  ]);
});

test('it prints every open row as one JSON object per line', async () => {
  const ctx = await setupTest();

  await ctx.www(['wait', 'the feed key', '--who', 'harbourmaster', '--note', 'asked on Monday']);

  const rows = await ctx.json(['rows']);

  expect(rows).toStrictEqual([
    {
      id: 'goal',
      label: 'goal',
      text: 'Ship the tide alerts',
      by: 'agent',
      at: '2026-03-01T09:00:01.000Z',
    },
    {
      id: 'wait-1',
      label: 'wait',
      text: 'the feed key',
      note: 'asked on Monday',
      who: 'harbourmaster',
      by: 'agent',
      at: '2026-03-01T09:00:02.000Z',
    },
  ]);
});

test('it keeps one row for goal, pin and now, and the last write wins', async () => {
  const ctx = await setupTest();

  await ctx.www(['now', 'Write the parser']);
  await ctx.www(['now', 'Test the parser']);
  await ctx.www(['pin', 'A sailor reads an alert in one glance']);

  const reply = await ctx.json(['rows']);

  const rows = z.array(z.object({ id: z.string(), text: z.string() })).parse(reply);

  expect(rows.map((row) => `${row.id}: ${row.text}`)).toStrictEqual([
    'goal: Ship the tide alerts',
    'now: Test the parser',
    'pin: A sailor reads an alert in one glance',
  ]);
});

test('it takes a grant in any words', async () => {
  const ctx = await setupTest();
  const result = await ctx.www(['grant', 'do the thing']);

  expect(result.exitCode).toBe(0);
});

test.each([
  {
    title: 'a wait with no who',
    argv: ['wait', 'the feed key'],
    run: 'www wait "<text>" --who <who>',
  },
  {
    title: 'a decision with no reason',
    argv: ['decide', 'Plain text'],
    run: 'www decide "<text>" --why "<reason>"',
  },
  {
    title: 'a pr that is no number or URL',
    argv: ['pr', 'the alerts one'],
    run: 'www pr <number or URL>',
  },
  { title: 'a label with no text', argv: ['task'], run: 'www task "<text>"' },
  { title: 'a text of 301 characters', argv: ['task', 'x'.repeat(301)], run: 'www task "<text>"' },
])('it refuses $title, writes nothing and names the command to run', async (row) => {
  const ctx = await setupTest();

  const rowsPath = join(ctx.root, 'tide', 'rows.jsonl');

  const before = await readFile(rowsPath, 'utf8');
  const result = await ctx.www(row.argv);
  const after = await readFile(rowsPath, 'utf8');

  const refusal = z.object({ run: z.string() }).parse(JSON.parse(result.stderr));

  expect({
    exitCode: result.exitCode,
    run: refusal.run,
    isUnchanged: after === before,
  }).toStrictEqual({ exitCode: 2, run: row.run, isUnchanged: true });
});

test('it takes a text of 300 characters and a note of 1,500', async () => {
  const ctx = await setupTest();
  const result = await ctx.www(['task', 'x'.repeat(300), '--note', 'y'.repeat(1500)]);

  expect(result.exitCode).toBe(0);
});

test('it takes a pr as a number or a pull request URL', async () => {
  const ctx = await setupTest();
  const number = await ctx.www(['pr', '12']);
  const url = await ctx.www(['pr', 'https://github.com/harbour/tide/pull/12']);

  expect([number.exitCode, url.exitCode]).toStrictEqual([0, 0]);
});

test('it changes a row with set and keeps the fields it was not given', async () => {
  const ctx = await setupTest();

  await ctx.www(['task', 'Parse the feed', '--note', 'blocked by wait-1']);
  await ctx.www(['set', 'task-1', 'Parse the tide feed']);

  const reply = await ctx.json(['rows']);

  const rows = z
    .array(z.object({ id: z.string(), text: z.string(), note: z.string().optional() }))
    .parse(reply);

  expect(rows.find((row) => row.id === 'task-1')).toMatchObject({
    text: 'Parse the tide feed',
    note: 'blocked by wait-1',
  });
});

test('it takes a closed row out of the open rows and keeps it under --all with its evidence', async () => {
  const ctx = await setupTest();

  await ctx.www(['task', 'Parse the feed']);
  await ctx.www(['done', 'task-1', '--evidence', 'PR 12 merged']);

  const openReply = await ctx.json(['rows']);
  const allReply = await ctx.json(['rows', '--all']);

  const open = z.array(z.object({ id: z.string() })).parse(openReply);
  const closedSchema = z.object({ how: z.string(), evidence: z.string() });

  const all = z
    .array(z.object({ id: z.string(), closed: closedSchema.optional() }))
    .parse(allReply);

  expect({
    open: open.map((row) => row.id),
    closed: all.at(-1)?.closed,
  }).toMatchObject({ open: ['goal'], closed: { how: 'done', evidence: 'PR 12 merged' } });
});

test('it refuses to close a row that is not open', async () => {
  const ctx = await setupTest();
  const result = await ctx.www(['done', 'task-9']);

  expect(result.exitCode).toBe(2);
});

test('it prints the brief with goal, pin, grant, now and waits first, then each label as it appeared', async () => {
  const ctx = await setupTest();

  await ctx.www(['rule', 'Alerts go out in plain text']);
  await ctx.www(['wait', 'the feed key', '--who', 'harbourmaster']);
  await ctx.www(['now', 'Write the parser']);
  await ctx.www(['grant', 'merge the alert PRs yourself']);
  await ctx.www(['pin', 'A sailor reads an alert in one glance']);

  const brief = await ctx.www([]);

  expect(brief.stdout).toBe(
    [
      'tide · 6 open rows · last write 0m ago',
      'GOAL   Ship the tide alerts',
      'PIN    A sailor reads an alert in one glance',
      'GRANT  grant-1  merge the alert PRs yourself',
      'NOW    Write the parser',
      'WAIT   wait-1  the feed key [harbourmaster]',
      'RULE   rule-1  Alerts go out in plain text',
      'Everything: www rows | jq   ·   Write: www <label> "<text>"   ·   www help',
      '',
    ].join('\n'),
  );
});

test('it shows the newest rows of a long label with a count, and never shortens the grant', async () => {
  const ctx = await setupTest();

  for (let index = 1; index <= 14; index += 1) {
    await ctx.www(['grant', `allowance ${index}`]);
    await ctx.www(['note', `event ${index}`]);
  }

  const result = await ctx.www([]);

  const brief = result.stdout;

  expect({
    grants: brief.match(/allowance \d+/gu)?.length,
    notesHeading: /^NOTE.*$/mu.exec(brief)?.[0],
    hasOldestNote: brief.includes('event 1\n'),
  }).toStrictEqual({
    grants: 14,
    notesHeading: 'NOTE (14, newest 12 shown)',
    hasOldestNote: false,
  });
});

test('it skips a line it cannot read, counts it in the brief and keeps every other row', async () => {
  const ctx = await setupTest();

  await appendFile(join(ctx.root, 'tide', 'rows.jsonl'), 'not json at all\n');

  await ctx.www(['task', 'Parse the feed']);

  const result = await ctx.www([]);

  const brief = result.stdout;

  expect({
    head: brief.split('\n')[0],
    hasTask: brief.includes('Parse the feed'),
  }).toStrictEqual({
    head: 'tide · 2 open rows · last write 0m ago · 1 unreadable lines skipped',
    hasTask: true,
  });
});

test('it keeps every row when twenty writes land at once', async () => {
  const ctx = await setupTest();

  await Promise.all(
    Array.from({ length: 20 }, (_, index) =>
      ctx.www(['add', 'note', `event ${index}`, '--id', `n-${index}`]),
    ),
  );

  const rows = await ctx.json(['rows']);

  expect(rows).toHaveLength(21);
});

test('it keeps a bound shell on its session when init or attach names another', async () => {
  const ctx = await setupTest();
  const init = await ctx.www(['init', 'scratch', '--goal', 'Try a thing']);
  const attach = await ctx.www(['attach', 'scratch']);
  const brief = await ctx.www([]);

  expect({
    exitCodes: [init.exitCode, attach.exitCode],
    head: brief.stdout.split(' ')[0],
  }).toStrictEqual({ exitCodes: [2, 2], head: 'tide' });
});

test('it moves a bound shell with --switch', async () => {
  const ctx = await setupTest();

  await ctx.www(['init', 'scratch', '--goal', 'Try a thing', '--switch']);

  const brief = await ctx.www([]);

  expect(brief.stdout.split(' ')[0]).toBe('scratch');
});

test('it works on a named session from a shell with no host session', async () => {
  const ctx = await setupTest();
  const none = await ctx.www([], { agent: null });
  const named = await ctx.www(['--session', 'tide'], { agent: null });

  expect({ none: none.exitCode, named: named.stdout.split(' ')[0] }).toStrictEqual({
    none: 4,
    named: 'tide',
  });
});

test('it prints plain text with --human, for a reply and for a refusal', async () => {
  const ctx = await setupTest();
  const reply = await ctx.www(['task', 'Parse the feed', '--human']);
  const refusal = await ctx.www(['wait', 'the feed key', '--human']);

  expect({ reply: reply.stdout, refusal: refusal.stderr }).toStrictEqual({
    reply: 'task-1  task, written\n',
    refusal: 'www: a wait names who you wait on\nRun: www wait "<text>" --who <who>\n',
  });
});

test('it lists every session with its goal and its count of open rows', async () => {
  const ctx = await setupTest();
  const sessions = await ctx.json(['sessions']);

  expect(sessions).toStrictEqual([
    { name: 'tide', goal: 'Ship the tide alerts', open: 1, lastWrite: '2026-03-01T09:00:01.000Z' },
  ]);
});

test('it prints its version and its help', async () => {
  const ctx = await setupTest();
  const version = await ctx.www(['--version']);
  const help = await ctx.www(['help']);

  expect({ version: version.stdout, help: help.stdout.split('\n')[0] }).toStrictEqual({
    version: 'wherewerewe 9.9.9\n',
    help: 'www: notes for one long agent session, one labelled row at a time.',
  });
});

test('it refuses a command that version 0.1 had, and writes no row for it', async () => {
  const ctx = await setupTest();
  const refusal = await ctx.www(['show', 't-parser', '--human']);
  const rows = await ctx.json(['rows']);

  expect({ exitCode: refusal.exitCode, stderr: refusal.stderr, rows }).toStrictEqual({
    exitCode: 2,
    stderr:
      'www: show left in version 0.2: every note is a row now\nRun: www rows | jq   or   www help\n',
    rows: [expect.objectContaining({ id: 'goal' })],
  });
});
