import { parseArgs } from 'node:util';
import type { ParsedArgs, RefusalReason, TypedFlag } from '../types.ts';

export type ParseResult =
  | { readonly kind: 'args'; readonly args: ParsedArgs }
  | { readonly kind: 'refused'; readonly reason: RefusalReason };

// Reads the argv once, with every command's options, then checks the command and its shape.
// `-h`, `--help` and `help` alone give the command `help`.
export function parseCLIArgs(argv: readonly string[]): ParseResult {
  try {
    return checkArgs(argv);
  } catch (error) {
    if (!(error instanceof Error) || !('code' in error)) {
      throw error;
    }

    const flag = /'(?<flag>-[^' ]*)/u.exec(error.message)?.groups?.['flag'] ?? '';

    return error.message.includes('missing')
      ? { kind: 'refused', reason: { kind: 'flag-needs-value', flag: flag.replace(/^-+/u, '') } }
      : { kind: 'refused', reason: { kind: 'unknown-flag', flag } };
  }
}

const options = {
  session: { type: 'string' },
  goal: { type: 'string' },
  who: { type: 'string' },
  where: { type: 'string' },
  scope: { type: 'string' },
  quote: { type: 'string' },
  why: { type: 'string' },
  on: { type: 'string' },
  replaces: { type: 'string' },
  evidence: { type: 'string' },
  for: { type: 'string' },
  'blocked-by': { type: 'string' },
  since: { type: 'string' },
  op: { type: 'string' },
  id: { type: 'string' },
  pr: { type: 'string', multiple: true },
  branch: { type: 'string', multiple: true },
  path: { type: 'string', multiple: true },
  pid: { type: 'string', multiple: true },
  once: { type: 'boolean' },
  standing: { type: 'boolean' },
  'ruled-out': { type: 'boolean' },
  help: { type: 'boolean', short: 'h' },
} as const;

const checkFlags = ['pr', 'branch', 'path', 'pid'];

const commandShapes: Readonly<
  Record<
    string,
    { readonly count: number; readonly usage: string; readonly flags: readonly string[] }
  >
> = {
  brief: { count: 0, usage: 'no arguments', flags: [] },
  help: { count: 0, usage: 'no arguments', flags: [] },
  sessions: { count: 0, usage: 'no arguments', flags: [] },
  detach: { count: 0, usage: 'no arguments', flags: [] },
  init: { count: 1, usage: '<name>', flags: ['goal'] },
  attach: { count: 1, usage: '<name>', flags: [] },
  goal: { count: 1, usage: '"<what done means>"', flags: [] },
  now: { count: 2, usage: '<id> "<next step>"', flags: [] },
  task: { count: 2, usage: '<id> "<claim>"', flags: [...checkFlags, 'blocked-by'] },
  wait: { count: 2, usage: '<id> "<what>"', flags: [...checkFlags, 'who'] },
  rule: { count: 2, usage: '<id> "<do it this way, and why>"', flags: checkFlags },
  where: {
    count: 2,
    usage: '<id> "<what and where, and how to stop it>"',
    flags: checkFlags,
  },
  set: { count: 2, usage: '<id> "<claim>"', flags: checkFlags },
  done: { count: 1, usage: '<id>', flags: ['evidence'] },
  drop: { count: 1, usage: '<id>', flags: ['why'] },
};

const laterCommands: ReadonlySet<string> = new Set([
  'ok',
  'use',
  'decide',
  'show',
  'log',
  'import',
  'say',
  'ack',
  'install',
  'doctor',
  'hook',
]);

function checkArgs(argv: readonly string[]): ParseResult {
  const parsed = parseArgs({
    args: [...argv],
    options,
    strict: true,
    allowPositionals: true,
    tokens: true,
  });

  const positionals = parsed.tokens.flatMap((token) =>
    token.kind === 'positional' ? [token.value] : [],
  );

  const flags: TypedFlag[] = parsed.tokens.flatMap((token) =>
    token.kind === 'option' && token.name !== 'session'
      ? [{ name: token.name, value: typeof token.value === 'string' ? token.value : null }]
      : [],
  );

  const [first, ...rest] = positionals;
  const isHelp = first === undefined && flags.length === 1 && parsed.values.help === true;
  const command = isHelp ? 'help' : (first ?? 'brief');

  const args: ParsedArgs = {
    command,
    positionals: rest,
    values: parsed.values,
    sessionFlag: parsed.values.session ?? null,
    flags: isHelp ? [] : flags,
  };

  const shape = commandShapes[command];

  if (first === 'brief' || (shape === undefined && !laterCommands.has(command))) {
    return { kind: 'refused', reason: { kind: 'unknown-command', command } };
  }

  if (shape === undefined) {
    return { kind: 'refused', reason: { kind: 'later-command', command } };
  }

  const stray = args.flags.find((flag) => !shape.flags.includes(flag.name));

  if (stray !== undefined) {
    return { kind: 'refused', reason: { kind: 'flag-not-taken', command, flag: stray.name } };
  }

  if (rest.length !== shape.count) {
    return {
      kind: 'refused',
      reason: { kind: 'wrong-positionals', command, usage: shape.usage },
    };
  }

  return { kind: 'args', args };
}
