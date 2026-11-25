import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Row } from '../types.ts';

// The rows of a version 0.1 store, read from its files. The files stay as they are.
export async function convertOldStore(folder: string): Promise<readonly Row[]> {
  const session = await readFile(join(folder, 'session'), 'utf8').catch(() => null);

  if (session === null) {
    return [];
  }

  const pairs = session
    .split('\n')
    .map((line) => /^(?<key>[a-z_]+)=(?<value>.*)$/u.exec(line)?.groups)
    .filter((groups) => groups !== undefined)
    .map((groups) => ({ key: groups['key'] ?? '', value: groups['value'] ?? '' }));

  const first = (key: string): string | undefined => pairs.find((pair) => pair.key === key)?.value;
  const rows: Row[] = [];
  const goal = first('goal');

  if (goal !== undefined) {
    rows.push(buildRow('goal', 'goal', goal, { at: first('started') }));
  }

  const grants = pairs.filter((pair) => /^grant_(?:may|not|never)$/u.test(pair.key));

  for (const [index, grant] of grants.entries()) {
    const kind = grant.key.replace('grant_', '');

    rows.push(
      buildRow(`grant-${index + 1}`, 'grant', `${kind}: ${grant.value}`, {
        at: first('grant_set'),
      }),
    );
  }

  const next = first('now_next');

  if (next !== undefined && next !== '-') {
    rows.push(buildRow('now', 'now', next, { note: first('now'), at: first('now_set') }));
  }

  const noteTable = await readTable(folder, 'notes.tsv');

  const notes = new Map(noteTable.map((row) => [row['id'], row['note']]));

  for (const item of await readTable(folder, 'items.tsv')) {
    const who = /who=(?<who>[^\s;]+)/u.exec(item['extra'] ?? '')?.groups?.['who'];

    rows.push(
      buildRow(item['id'] ?? '', item['kind'] ?? 'task', item['claim'] ?? '', {
        note: notes.get(item['id']),
        who,
        at: findCell(item, 'written'),
      }),
    );
  }

  for (const row of await readTable(folder, 'words.tsv')) {
    rows.push(
      buildRow(row['id'] ?? '', 'words', row['words'] ?? '', {
        note: findCell(row, 'where'),
        at: findCell(row, 'written'),
      }),
    );
  }

  for (const row of await readTable(folder, 'lessons.tsv')) {
    const why = findCell(row, 'why');

    rows.push(
      buildRow(row['id'] ?? '', 'lesson', row['text'] ?? '', {
        note: why === undefined ? undefined : `why: ${why}`,
        at: findCell(row, 'written'),
      }),
    );
  }

  for (const row of await readTable(folder, 'promises.tsv')) {
    rows.push(
      buildRow(row['id'] ?? '', 'promise', row['what'] ?? '', {
        who: findCell(row, 'to'),
        note: findCell(row, 'by_when'),
        at: findCell(row, 'written'),
      }),
    );
  }

  for (const row of await readTable(folder, 'journal.tsv')) {
    if (row['op'] === 'decide') {
      const why = findCell(row, 'why');

      rows.push(
        buildRow(row['id'] ?? '', 'decision', row['text'] ?? '', {
          note: why === undefined ? undefined : `why: ${why}`,
          at: findCell(row, 'ts'),
        }),
      );
    }
  }

  return rows.filter((row) => row.id !== '' && row.text !== '');
}

function buildRow(
  id: string,
  label: string,
  text: string,
  rest: { note?: string | undefined; who?: string | undefined; at?: string | undefined } = {},
): Row {
  return {
    id,
    label,
    text,
    ...(rest.note === undefined ? {} : { note: rest.note }),
    ...(rest.who === undefined ? {} : { who: rest.who }),
    by: 'agent',
    at: rest.at ?? new Date(0).toISOString(),
  };
}

type Table = readonly Readonly<Record<string, string>>[];

async function readTable(folder: string, file: string): Promise<Table> {
  const text = await readFile(join(folder, file), 'utf8').catch(() => '');

  const [header, ...lines] = text.split('\n').filter((line) => line !== '');
  const columns = header?.split('\t') ?? [];

  return lines.map((line) => {
    const cells = line.split('\t');

    return Object.fromEntries(columns.map((column, index) => [column, cells[index] ?? '-']));
  });
}

function findCell(row: Readonly<Record<string, string>>, column: string): string | undefined {
  const value = row[column];

  return value === undefined || value === '-' || value === '' ? undefined : value;
}
