import { appendRow } from '../store/append-row.ts';
import type { Args, Context, Reply } from '../types.ts';
import { checkLength } from './check-length.ts';
import { noteLimit } from './constants.ts';
import { readOpenRow } from './read-open-row.ts';

export async function runClose(
  context: Context,
  args: Args,
  how: 'done' | 'dropped',
): Promise<Reply> {
  const verb = how === 'done' ? 'done' : 'drop';

  const target = await readOpenRow(context, args, verb);

  const row = target.row;
  const evidence = args.values['evidence'] ?? args.values['why'];

  checkLength(evidence, noteLimit, 'evidence', `www ${verb} ${row.id}`);

  const at = new Date(context.now()).toISOString();

  await appendRow(target.root, target.name, {
    ...row,
    at,
    closed: { at, how, ...(evidence === undefined ? {} : { evidence }) },
  });

  return { json: { ok: true, id: row.id, closed: how }, human: `${row.id}  ${how}` };
}
