import { listSessions } from '../store/list-sessions.ts';
import { readRoot } from '../store/read-root.ts';
import { readRows } from '../store/read-rows.ts';
import type { Context, Reply } from '../types.ts';

export async function runSessions(context: Context): Promise<Reply> {
  const root = readRoot(context.env);

  const names = await listSessions(root);

  const sessions = await Promise.all(
    names.map(async (name) => {
      const store = await readRows(root, name);

      const open = store.rows.filter((row) => row.closed === undefined);

      return {
        name,
        goal: open.find((row) => row.label === 'goal')?.text ?? null,
        open: open.length,
        lastWrite: store.lines.at(-1)?.at ?? null,
      };
    }),
  );

  return {
    json: sessions,
    human: sessions
      .map((session) => `${session.name}\t${session.open} open\t${session.goal ?? ''}`)
      .join('\n'),
  };
}
