import { parseArgs } from 'node:util';
import { match } from 'ts-pattern';
import type { ParsedArgs, RefusalReason, TypedFlag } from '../types.ts';

export type ParseResult =
  | { readonly kind: 'args'; readonly args: ParsedArgs }
  | {
      readonly kind: 'refused';
      readonly reason: RefusalReason;

      // the --session value typed, when the parser got far enough to read it
      readonly sessionFlag: string | null;
    };

// Reads the argv once, with every command's options, then checks the command and its shape.
// `-h`, `--help` and `help` alone give the command `help`.
export function parseCLIArgs(argv: readonly string[]): ParseResult {
  try {
    return checkArgs(argv);
  } catch (error) {
    if (!(error instanceof Error) || !('code' in error)) {
      throw error;
    }

    const flag =
      /--[A-Za-z][A-Za-z-]*/u.exec(error.message)?.[0] ??
      /-[A-Za-z]\b/u.exec(error.message)?.[0] ??
      '';

    const name = flag.replace(/^-+/u, '');

    const reason = match(error.code)
      .with('ERR_PARSE_ARGS_UNKNOWN_OPTION', (): RefusalReason => ({ kind: 'unknown-flag', flag }))
      .with('ERR_PARSE_ARGS_INVALID_OPTION_VALUE', (): RefusalReason =>
        isStringOption(name)
          ? { kind: 'flag-needs-value', flag: name }
          : { kind: 'flag-takes-no-value', flag: name },
      )
      .otherwise(() => {
        throw error;
      });

    return { kind: 'refused', reason, sessionFlag: null };
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

interface CommandShape {
  readonly count: number;
  readonly usage: string;
  readonly flags: readonly string[];
}

// A map, so a command named like an inherited object property, such as toString, is unknown.
const commandShapes: ReadonlyMap<string, CommandShape> = new Map([
  ['brief', { count: 0, usage: 'no arguments', flags: [] }],
  ['help', { count: 0, usage: 'no arguments', flags: [] }],
  ['sessions', { count: 0, usage: 'no arguments', flags: [] }],
  ['detach', { count: 0, usage: 'no arguments', flags: [] }],
  ['init', { count: 1, usage: '<name>', flags: ['goal'] }],
  ['attach', { count: 1, usage: '<name>', flags: [] }],
  ['goal', { count: 1, usage: '"<what done means>"', flags: [] }],
  ['now', { count: 2, usage: '<id> "<next step>"', flags: [] }],
  ['task', { count: 2, usage: '<id> "<claim>"', flags: [...checkFlags, 'blocked-by'] }],
  ['wait', { count: 2, usage: '<id> "<what>"', flags: [...checkFlags, 'who'] }],
  ['rule', { count: 2, usage: '<id> "<do it this way, and why>"', flags: checkFlags }],
  ['where', { count: 2, usage: '<id> "<what and where, and how to stop it>"', flags: checkFlags }],
  ['set', { count: 2, usage: '<id> "<claim>"', flags: checkFlags }],
  ['done', { count: 1, usage: '<id>', flags: ['evidence'] }],
  ['drop', { count: 1, usage: '<id>', flags: ['why'] }],
]);

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
    match(token)
      .with({ kind: 'positional' }, (positional) => [positional.value])
      .with({ kind: 'option' }, { kind: 'option-terminator' }, () => [])
      .exhaustive(),
  );

  const flags: TypedFlag[] = parsed.tokens.flatMap((token) =>
    match(token)
      .with({ kind: 'option' }, (option) =>
        option.name === 'session'
          ? []
          : [{ name: option.name, value: typeof option.value === 'string' ? option.value : null }],
      )
      .with({ kind: 'positional' }, { kind: 'option-terminator' }, () => [])
      .exhaustive(),
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

  const shape = commandShapes.get(command);

  const refuse = (reason: RefusalReason): ParseResult => ({
    kind: 'refused',
    reason,
    sessionFlag: args.sessionFlag,
  });

  if (first === 'brief' || (shape === undefined && !laterCommands.has(command))) {
    return refuse({ kind: 'unknown-command', command });
  }

  if (shape === undefined) {
    return refuse({ kind: 'later-command', command });
  }

  const stray = args.flags.find((flag) => !shape.flags.includes(flag.name));

  if (stray !== undefined) {
    return refuse({ kind: 'flag-not-taken', command, flag: stray.name });
  }

  if (rest.length !== shape.count) {
    return refuse({ kind: 'wrong-positionals', command, usage: shape.usage });
  }

  return { kind: 'args', args };
}

function isStringOption(name: string): boolean {
  return Object.entries(options).some(([key, option]) => key === name && option.type === 'string');
}
