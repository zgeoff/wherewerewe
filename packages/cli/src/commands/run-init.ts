import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { RefusalError } from '../refusal-error.ts';
import { appendRow } from '../store/append-row.ts';
import { isName } from '../store/is-name.ts';
import { probeSession } from '../store/probe-session.ts';
import { readRoot } from '../store/read-root.ts';
import type { Args, Context, Reply } from '../types.ts';
import { bindSession } from './bind-session.ts';
import { checkLength } from './check-length.ts';
import { textLimit } from './constants.ts';
import { stamp } from './stamp.ts';

export async function runInit(context: Context, args: Args): Promise<Reply> {
  const [name] = args.words;
  const goal = args.values['goal'];
  const run = 'www init <name> --goal "<what done means>"';

  if (name === undefined || !isName(name) || goal === undefined) {
    throw new RefusalError(
      'init takes a name of lower-case letters, digits and dashes, and a goal',
      run,
    );
  }

  checkLength(goal, textLimit, 'text', run);

  const root = readRoot(context.env);

  const exists = await probeSession(root, name);

  if (exists) {
    throw new RefusalError(`a session named ${name} exists`, `www attach ${name}`);
  }

  await mkdir(join(root, name), { recursive: true });
  await appendRow(root, name, { id: 'goal', label: 'goal', text: goal, ...stamp(context) });

  const bound = await bindSession(context, name, args.switches.has('switch'));

  return {
    json: { ok: true, session: name, bound },
    human: `Started ${name}.${bound ? ' Bound to this shell.' : ''}`,
  };
}
