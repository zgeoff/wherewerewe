import { readRows } from '../store/read-rows.ts';
import type { Args, Context, Reply } from '../types.ts';
import { openSession } from './open-session.ts';

export async function runRows(context: Context, args: Args): Promise<Reply> {
  const session = await openSession(context, args);
  const store = await readRows(session.root, session.name);

  const rows = args.switches.has('all')
    ? store.lines
    : store.rows.filter((row) => row.closed === undefined);

  return {
    json: rows,
    human: rows.map((row) => `${row.id}\t${row.label}\t${row.text}`).join('\n'),
  };
}
