import { appendRow } from '../store/append-row.ts';
import type { Args, Context, Reply } from '../types.ts';
import { checkLength } from './check-length.ts';
import { noteLimit, textLimit } from './constants.ts';
import { readOpenRow } from './read-open-row.ts';
import { stamp } from './stamp.ts';

export async function runSet(context: Context, args: Args): Promise<Reply> {
  const target = await readOpenRow(context, args, 'set');

  const row = target.row;
  const text = args.words[1] ?? row.text;
  const note = args.values['note'] ?? row.note;
  const who = args.values['who'] ?? row.who;
  const run = `www set ${row.id} "<text>"`;

  checkLength(text, textLimit, 'text', run);
  checkLength(note, noteLimit, 'note', run);

  await appendRow(target.root, target.name, {
    id: row.id,
    label: row.label,
    text,
    ...(note === undefined ? {} : { note }),
    ...(who === undefined ? {} : { who }),
    ...stamp(context),
  });

  return { json: { ok: true, id: row.id }, human: `${row.id}  changed` };
}
