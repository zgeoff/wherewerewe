import { readRoot } from '../store/read-root.ts';
import { resolveSession } from '../store/resolve-session.ts';
import type { Args, Context } from '../types.ts';

export interface OpenSession {
  readonly root: string;
  readonly name: string;
}

export async function openSession(context: Context, args: Args): Promise<OpenSession> {
  const root = readRoot(context.env);

  const name = await resolveSession(root, context.env, args.values['session']);

  return { root, name };
}
