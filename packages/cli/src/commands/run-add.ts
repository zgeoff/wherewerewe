import { RefusalError } from '../refusal-error.ts';
import { appendRow } from '../store/append-row.ts';
import { isID } from '../store/is-id.ts';
import { nextID } from '../store/next-id.ts';
import { readRows } from '../store/read-rows.ts';
import type { Args, Context, Reply, Row } from '../types.ts';
import { checkLength } from './check-length.ts';
import { noteLimit, textLimit } from './constants.ts';
import { openSession } from './open-session.ts';
import { stamp } from './stamp.ts';

// A label with one row: writing it again replaces the row.
const singleLabels = new Set(['goal', 'pin', 'now']);

const labelPattern = /^[a-z][a-z0-9-]{0,23}$/u;

export async function runAdd(context: Context, args: Args, typed: string): Promise<Reply> {
  const label = typed === 'decide' ? 'decision' : typed;
  const [text] = args.words;
  const run = `www ${typed} "<text>"`;

  if (!labelPattern.test(label)) {
    throw new RefusalError(
      `${label} is not a label: use lower-case letters, digits and dashes`,
      'www help',
    );
  }

  if (text === undefined || text.trim() === '' || args.words.length > 1) {
    throw new RefusalError(`${typed} takes one text, in quotes`, run);
  }

  checkShape(label, text, args);

  const why = args.values['why'];
  const note = args.values['note'] ?? (why === undefined ? undefined : `why: ${why}`);

  checkLength(text, textLimit, 'text', run);
  checkLength(note, noteLimit, 'note', run);

  const session = await openSession(context, args);
  const store = await readRows(session.root, session.name);

  const id = singleLabels.has(label) ? label : (args.values['id'] ?? nextID(store.lines, label));

  if (!isID(id)) {
    throw new RefusalError(`${id} is not an id: use letters, digits, dots and dashes`, run);
  }

  const existing = store.rows.find((row) => row.id === id);

  if (existing !== undefined && !singleLabels.has(label) && existing.closed === undefined) {
    throw new RefusalError(`${id} is an open row already`, `www set ${id} "<text>"`);
  }

  const who = args.values['who'];

  const row: Row = {
    id,
    label,
    text,
    ...(note === undefined ? {} : { note }),
    ...(who === undefined ? {} : { who }),
    ...stamp(context),
  };

  await appendRow(session.root, session.name, row);

  return { json: { ok: true, id, label }, human: `${id}  ${label}, written` };
}

// Shape checks on the way in, one per label that has one.
function checkShape(label: string, text: string, args: Args): void {
  if (label === 'wait' && args.values['who'] === undefined) {
    throw new RefusalError('a wait names who you wait on', 'www wait "<text>" --who <who>');
  }

  if (label === 'decision' && args.values['why'] === undefined) {
    throw new RefusalError('a decision gives its reason', 'www decide "<text>" --why "<reason>"');
  }

  if (label === 'pr' && !/^(?:#?\d+|https:\/\/\S+\/pull\/\d+\S*)$/u.test(text)) {
    throw new RefusalError('a pr is a number or a pull request URL', 'www pr <number or URL>');
  }
}
