import { formatBrief } from '../brief/format-brief.ts';
import { readRows } from '../store/read-rows.ts';
import type { Args, Context } from '../types.ts';
import { openSession } from './open-session.ts';

export async function runBrief(context: Context, args: Args): Promise<string> {
  const session = await openSession(context, args);
  const store = await readRows(session.root, session.name);

  return formatBrief(session.name, store, context.now());
}
