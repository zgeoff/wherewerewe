import { expect, test } from 'bun:test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { createTestHome } from '../test-utils/create-test-home.ts';

async function setupTest() {
  const home = createTestHome();

  const files = {
    session:
      'format=2\nname=tide\ngoal=Ship the tide alerts\ngrant_may=merge the alert PRs\ngrant_never=touch the harbour database\nnow=t-parse\nnow_next=Write the parser\nstarted=2026-02-01T08:00:00Z\n',
    'items.tsv':
      'id\tkind\tclaim\tcheck\tat_write\tlast\twritten\tby\textra\nt-parse\ttask\tParse the feed\t-\t-\t-\t2026-02-01T09:00:00Z\tagent\t-\nw-key\twait\tthe feed key\t-\t-\t-\t2026-02-01T09:05:00Z\tagent\twho=harbourmaster\n',
    'notes.tsv': 'id\towed\twritten\tnote\nt-parse\t-\t2026-02-01T09:01:00Z\tthe feed is XML\n',
    'words.tsv':
      'id\twords\twhere\twritten\tby\no-plain\tkeep it plain\tchat\t2026-02-01T09:10:00Z\towner\n',
    'lessons.tsv':
      'id\ttext\twhy\twritten\tby\nl-tz\tStore times in UTC\tan alert went out an hour late\t2026-02-01T09:20:00Z\tagent\n',
    'journal.tsv':
      'ts\top\tid\tby\ttext\twhy\textra\n2026-02-01T09:30:00Z\tdecide\td-1\tagent\tAlerts are plain text\tthe radio reads them aloud\t-\n2026-02-01T09:31:00Z\tnote\tt-parse\tagent\tx\t-\t-\n',
  };

  await mkdir(join(home.root, 'tide'), { recursive: true });

  for (const [name, text] of Object.entries(files)) {
    await writeFile(join(home.root, 'tide', name), text);
  }

  return { ...home, files };
}

test('it reads a version 0.1 store as rows on the first read', async () => {
  const ctx = await setupTest();
  const reply = await ctx.json(['rows', '--session', 'tide']);

  const rows = z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
        text: z.string(),
        note: z.string().optional(),
        who: z.string().optional(),
      }),
    )
    .parse(reply);

  const picked = rows.map((row) => ({
    id: row.id,
    label: row.label,
    text: row.text,
    note: row.note,
    who: row.who,
  }));

  expect(picked).toStrictEqual([
    { id: 'goal', label: 'goal', text: 'Ship the tide alerts', note: undefined, who: undefined },
    {
      id: 'grant-1',
      label: 'grant',
      text: 'may: merge the alert PRs',
      note: undefined,
      who: undefined,
    },
    {
      id: 'grant-2',
      label: 'grant',
      text: 'never: touch the harbour database',
      note: undefined,
      who: undefined,
    },
    { id: 'now', label: 'now', text: 'Write the parser', note: 't-parse', who: undefined },
    {
      id: 't-parse',
      label: 'task',
      text: 'Parse the feed',
      note: 'the feed is XML',
      who: undefined,
    },
    { id: 'w-key', label: 'wait', text: 'the feed key', note: undefined, who: 'harbourmaster' },
    { id: 'o-plain', label: 'words', text: 'keep it plain', note: 'chat', who: undefined },
    {
      id: 'l-tz',
      label: 'lesson',
      text: 'Store times in UTC',
      note: 'why: an alert went out an hour late',
      who: undefined,
    },
    {
      id: 'd-1',
      label: 'decision',
      text: 'Alerts are plain text',
      note: 'why: the radio reads them aloud',
      who: undefined,
    },
  ]);
});

test('it leaves the old files as they were and converts only once', async () => {
  const ctx = await setupTest();

  await ctx.www(['rows', '--session', 'tide']);
  await ctx.www(['done', 't-parse', '--session', 'tide']);

  await writeFile(join(ctx.root, 'tide', 'session'), 'goal=Changed after the convert\n');

  const reply = await ctx.json(['rows', '--session', 'tide']);

  const rows = z.array(z.object({ id: z.string(), text: z.string() })).parse(reply);

  const items = await readFile(join(ctx.root, 'tide', 'items.tsv'), 'utf8');

  expect({
    items,
    goal: rows.find((row) => row.id === 'goal')?.text,
    hasClosedTask: rows.some((row) => row.id === 't-parse'),
  }).toStrictEqual({
    items: ctx.files['items.tsv'],
    goal: 'Ship the tide alerts',
    hasClosedTask: false,
  });
});
