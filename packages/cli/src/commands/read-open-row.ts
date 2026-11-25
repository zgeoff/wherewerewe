import { RefusalError } from '../refusal-error.ts';
import { readRows } from '../store/read-rows.ts';
import type { Args, Context, Row } from '../types.ts';
import { openSession } from './open-session.ts';

export interface OpenRow {
  readonly root: string;
  readonly name: string;
  readonly row: Row;
}

export async function readOpenRow(context: Context, args: Args, verb: string): Promise<OpenRow> {
  const [id] = args.words;

  if (id === undefined) {
    throw new RefusalError(`${verb} takes the id of a row`, `www ${verb} <id>`);
  }

  const session = await openSession(context, args);
  const store = await readRows(session.root, session.name);

  const row = store.rows.find((candidate) => candidate.id === id && candidate.closed === undefined);

  if (row === undefined) {
    throw new RefusalError(`no open row has the id ${id}`, 'www rows --human');
  }

  return { root: session.root, name: session.name, row };
}
