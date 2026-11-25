import { RefusalError } from '../refusal-error.ts';
import { findAgentID } from '../store/find-agent-id.ts';
import { isName } from '../store/is-name.ts';
import { probeSession } from '../store/probe-session.ts';
import { readRoot } from '../store/read-root.ts';
import type { Args, Context, Reply } from '../types.ts';
import { bindSession } from './bind-session.ts';

export async function runAttach(context: Context, args: Args): Promise<Reply> {
  const [name] = args.words;
  const root = readRoot(context.env);
  const exists = name !== undefined && isName(name) ? await probeSession(root, name) : false;

  if (name === undefined || !exists) {
    throw new RefusalError(`no session is named ${name ?? ''}`.trim(), 'www sessions', 4);
  }

  if (findAgentID(context.env) === null) {
    throw new RefusalError(
      'this shell has no host session to bind',
      `www <command> --session ${name}`,
    );
  }

  await bindSession(context, name, args.switches.has('switch'));

  return { json: { ok: true, session: name }, human: `Bound this shell to ${name}.` };
}
