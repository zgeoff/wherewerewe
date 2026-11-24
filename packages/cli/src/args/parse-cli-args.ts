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

    return { kind: 'refused', reason, sessionFlag: pickSessionFlag(argv) };
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
  note: { type: 'string' },
  owed: { type: 'boolean' },
  'no-note': { type: 'boolean' },
  help: { type: 'boolean', short: 'h' },
} as const;

const checkFlags = ['pr', 'branch', 'path', 'pid'];
const noteFlags = ['note', 'owed'];

interface CommandShape {
  readonly counts: readonly number[];
  readonly usage: string;
  readonly flags: readonly string[];
}

// A map, so a command named like an inherited object property, such as toString, is unknown.
const commandShapes: ReadonlyMap<string, CommandShape> = new Map([
  ['brief', { counts: [0], usage: 'no arguments', flags: [] }],
  ['help', { counts: [0], usage: 'no arguments', flags: [] }],
  ['sessions', { counts: [0], usage: 'no arguments', flags: [] }],
  ['detach', { counts: [0], usage: 'no arguments', flags: [] }],
  ['init', { counts: [1], usage: '<name>', flags: ['goal'] }],
  ['attach', { counts: [1], usage: '<name>', flags: [] }],
  ['import', { counts: [1], usage: '<name>', flags: [] }],
  ['goal', { counts: [1], usage: '"<what done means>"', flags: [] }],
  ['now', { counts: [2], usage: '<id> "<next step>"', flags: noteFlags }],
  [
    'task',
    { counts: [2], usage: '<id> "<claim>"', flags: [...checkFlags, ...noteFlags, 'blocked-by'] },
  ],
  ['wait', { counts: [2], usage: '<id> "<what>"', flags: [...checkFlags, ...noteFlags, 'who'] }],
  [
    'rule',
    {
      counts: [2],
      usage: '<id> "<do it this way, and why>"',
      flags: [...checkFlags, ...noteFlags],
    },
  ],
  [
    'where',
    {
      counts: [2],
      usage: '<id> "<what and where, and how to stop it>"',
      flags: [...checkFlags, ...noteFlags],
    },
  ],
  [
    'set',
    { counts: [1, 2], usage: '<id> ["<claim>"]', flags: [...checkFlags, ...noteFlags, 'no-note'] },
  ],
  ['done', { counts: [1], usage: '<id>', flags: ['evidence'] }],
  ['drop', { counts: [1], usage: '<id>', flags: ['why'] }],
  [
    'ok',
    {
      counts: [1],
      usage: '<id>',
      flags: ['quote', 'who', 'where', 'scope', 'once', 'standing', ...noteFlags],
    },
  ],
  ['use', { counts: [1], usage: '<id>', flags: ['for'] }],
  [
    'decide',
    { counts: [1], usage: '"<choice>"', flags: ['why', 'on', 'who', 'ruled-out', 'replaces'] },
  ],
  ['say', { counts: [1], usage: '"<text>"', flags: ['on'] }],
  ['ack', { counts: [1], usage: 'o-<n>', flags: [] }],
  ['show', { counts: [1], usage: '<id>', flags: [] }],
  ['log', { counts: [0], usage: 'no arguments', flags: ['since', 'op', 'id'] }],
]);

const laterCommands: ReadonlySet<string> = new Set(['install', 'doctor', 'hook']);

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

  if (!shape.counts.includes(rest.length)) {
    return refuse({ kind: 'wrong-positionals', command, usage: shape.usage });
  }

  return { kind: 'args', args };
}

function isStringOption(name: string): boolean {
  return Object.entries(options).some(([key, option]) => key === name && option.type === 'string');
}

// Reads --session alone from the argv, leniently, so a refusal for another flag keeps the scope.
function pickSessionFlag(argv: readonly string[]): string | null {
  const lenient = parseArgs({
    args: [...argv],
    options: { session: { type: 'string' } },
    strict: false,
    allowPositionals: true,
  });

  return typeof lenient.values.session === 'string' ? lenient.values.session : null;
}
