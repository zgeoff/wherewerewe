import { parseArgs } from 'node:util';
import { match } from 'ts-pattern';
import { findListKind } from '../rules/find-list-kind.ts';
import { isWriteCommand } from '../rules/is-write-command.ts';
import { listKinds } from '../rules/list-kinds.ts';
import type { ParsedArgs, RefusalReason, TypedFlag } from '../types.ts';
import { joinDashValues } from './join-dash-values.ts';

export type ParseResult =
  | { readonly kind: 'args'; readonly args: ParsedArgs }
  | {
      readonly kind: 'refused';
      readonly reason: RefusalReason;

      // the --session value typed, when the parser got far enough to read it
      readonly sessionFlag: string | null;
    };

const options = {
  session: { type: 'string' },
  goal: { type: 'string' },
  who: { type: 'string' },
  where: { type: 'string' },
  scope: { type: 'string' },
  quote: { type: 'string' },
  may: { type: 'string', multiple: true },
  not: { type: 'string', multiple: true },
  never: { type: 'string', multiple: true },
  reading: { type: 'string' },
  drop: { type: 'string', multiple: true },
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
  to: { type: 'string' },
  by: { type: 'string' },
  owed: { type: 'boolean' },
  'no-note': { type: 'boolean' },
  json: { type: 'boolean' },
  paste: { type: 'boolean' },
  help: { type: 'boolean', short: 'h' },
} as const;

const flagTypes: ReadonlyMap<string, 'string' | 'boolean'> = new Map(
  Object.entries(options).map(([name, option]) => [name, option.type]),
);

// Reads the argv once, with every command's options, then checks the command and its shape.
// `-h`, `--help` and `help` alone give the command `help`.
export function parseCLIArgs(argv: readonly string[]): ParseResult {
  try {
    return checkArgs(argv);
  } catch (error) {
    const joined = joinDashValues(argv, flagTypes);
    const joinedError = joined === null ? null : findParseError(joined.argv);

    // a joined command that still fails gets the refusal of what it fails on, so a Run line parses
    const reason =
      joined !== null && joinedError === null
        ? { kind: 'flag-value-has-dash' as const, flag: joined.flag, argv: joined.argv }
        : toParseRefusal(joinedError ?? error, argv);

    return { kind: 'refused', reason, sessionFlag: pickSessionFlag(argv) };
  }
}

// Each command of the table, with the flags and the help line its refusal of a flag prints.
export function listCommandShapes(): readonly CommandShapeInfo[] {
  return [...commandShapes].map(([command, shape]) =>
    Object.assign(toCommandFlags(command, shape), { counts: shape.counts }),
  );
}

const checkFlags = ['pr', 'branch', 'path', 'pid'];
const noteFlags = ['note', 'owed'];
const grantFlags = ['may', 'not', 'never', 'scope', 'where', 'reading'];

interface CommandShape {
  readonly counts: readonly number[];
  readonly usage: string;
  readonly flags: readonly string[];

  // the command's line in the help text, after `www`, which a refused flag prints as its Run line
  readonly line: string;

  // flags the parser lets through so the command can refuse them with its own text, and that a
  // refusal of an unknown flag therefore never lists as taken
  readonly refused?: readonly string[];
}

// A map, so a command named like an inherited object property, such as toString, is unknown.
const commandShapes: ReadonlyMap<string, CommandShape> = new Map([
  ['brief', { counts: [0], usage: 'no arguments', flags: ['json'], line: '' }],
  ['help', { counts: [0], usage: 'no arguments', flags: [], line: 'help' }],
  ['sessions', { counts: [0], usage: 'no arguments', flags: [], line: 'sessions' }],
  ['detach', { counts: [0], usage: 'no arguments', flags: [], line: 'detach' }],
  ['init', { counts: [1], usage: '<name>', flags: ['goal'], line: 'init <name> --goal "<goal>"' }],
  ['attach', { counts: [1], usage: '<name>', flags: [], line: 'attach <name>' }],
  [
    'import',
    { counts: [1], usage: '<name>', flags: [...grantFlags, 'drop'], line: 'import <name>' },
  ],
  [
    'goal',
    {
      counts: [0, 1],
      usage: '"<what done means>"',
      flags: ['paste'],
      line: 'goal "<what done means>"',
    },
  ],
  [
    'grant',
    {
      counts: [0],
      usage: 'no arguments',
      flags: grantFlags,
      line: 'grant [--may "<words>"] [--not "<words>"] [--never "<words>"] [--scope "<scope>"] --where <where> --reading "<what they cover; what the owner kept back>"',
    },
  ],
  [
    'now',
    {
      counts: [2],
      usage: '<id> "<next step>"',
      flags: noteFlags,
      line: 'now <id> "<next step>" [--note "<detail>" [--owed]]',
    },
  ],
  [
    'task',
    {
      counts: [2],
      usage: '<id> "<claim>"',
      flags: [...checkFlags, ...noteFlags, 'blocked-by'],
      line: 'task <id> "<claim>" [<check>] [--blocked-by <id>] [--note "<detail>" [--owed]]',
    },
  ],
  [
    'wait',
    {
      counts: [2],
      usage: '<id> "<what>"',
      flags: [...checkFlags, ...noteFlags, 'who'],
      line: 'wait <id> "<what>" --who <who> [<check>]',
    },
  ],
  [
    'rule',
    {
      counts: [2],
      usage: '<id> "<do it this way, and why>"',
      flags: [...checkFlags, ...noteFlags],
      refused: checkFlags,
      line: 'rule <id> "<do it this way, and why>"',
    },
  ],
  [
    'lesson',
    {
      counts: [2],
      usage: '<id> "<do this>"',
      flags: ['why'],
      line: 'lesson <id> "<do this>" --why "<the mistake behind it>"',
    },
  ],
  [
    'promise',
    {
      counts: [2],
      usage: '<id> "<what>"',
      flags: ['to', 'by'],
      line: 'promise <id> "<what>" --to <who> --by <when>',
    },
  ],
  [
    'words',
    {
      counts: [2],
      usage: '<id> "<the owner\'s exact words>"',
      flags: ['where'],
      line: 'words <id> "<the owner\'s exact words>" --where <where>',
    },
  ],
  [
    'where',
    {
      counts: [2],
      usage: '<id> "<what and where, and how to stop it>"',
      flags: [...checkFlags, ...noteFlags],
      line: 'where <id> "<what and where, and how to stop it>" [<check>]',
    },
  ],
  [
    'set',
    {
      counts: [1, 2],
      usage: '<id> ["<claim>"]',
      flags: [...checkFlags, ...noteFlags, 'no-note'],
      line: 'set <id> ["<claim>"] [<check>] [--note "<detail>" [--owed] | --no-note]',
    },
  ],
  [
    'done',
    {
      counts: [1],
      usage: '<id>',
      flags: ['evidence'],
      line: 'done <id> --evidence "<PR, commit or test run>"',
    },
  ],
  ['drop', { counts: [1], usage: '<id>', flags: ['why'], line: 'drop <id> --why "<reason>"' }],
  [
    'ok',
    {
      counts: [1],
      usage: '<id>',
      flags: ['quote', 'who', 'where', 'scope', 'once', 'standing', ...noteFlags],
      refused: ['standing'],
      line: 'ok <id> --quote "<their exact words>" --who <who> --where <where> --scope "<scope>"',
    },
  ],
  [
    'use',
    { counts: [1], usage: '<id>', flags: ['for'], line: 'use <id> --for "<what you did with it>"' },
  ],
  [
    'decide',
    {
      counts: [1],
      usage: '"<choice>"',
      flags: ['why', 'on', 'who', 'ruled-out', 'replaces'],
      line: 'decide "<choice>" --why "<reason>" [--on <id>] [--who owner] [--ruled-out] [--replaces d-<n>]',
    },
  ],
  ['say', { counts: [1], usage: '"<text>"', flags: ['on'], line: 'say "<text>" [--on <id>]' }],
  ['ack', { counts: [1], usage: 'o-<n>', flags: [], line: 'ack o-<n>' }],
  ['show', { counts: [0, 1], usage: '[<id>]', flags: ['json'], line: 'show [<id>]' }],
  [
    'log',
    {
      counts: [0],
      usage: 'no arguments',
      flags: ['since', 'op', 'id', 'json'],
      line: 'log [--since <t>] [--op <op,...>] [--id <id>]',
    },
  ],
  [
    'recap',
    { counts: [0], usage: 'no arguments', flags: ['since', 'json'], line: 'recap [--since <t>]' },
  ],
  [
    'list',
    {
      counts: [0, 1],
      usage: '<kind>',
      flags: ['json'],
      line: `list <${listKinds.join('|')}>`,
    },
  ],
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

  if (first === 'brief' || shape === undefined) {
    return refuse(refuseCommand(command));
  }

  const stray = args.flags.find((flag) => !shape.flags.includes(flag.name));

  if (stray !== undefined) {
    return refuse({
      kind: 'flag-not-taken',
      flag: `--${stray.name}`,
      ...toCommandFlags(command, shape),
    });
  }

  if (command === 'goal' && args.values.paste === true && rest.length > 0) {
    return refuse({ kind: 'goal-paste-with-text' });
  }

  const isGoalWithNothing = command === 'goal' && rest.length === 0 && args.values.paste !== true;

  if (!shape.counts.includes(rest.length) || isGoalWithNothing) {
    return refuse({ kind: 'wrong-positionals', command, usage: shape.usage, line: shape.line });
  }

  if (command === 'list' && findListKind(rest[0]) === null) {
    return refuse({ kind: 'bad-list-kind' });
  }

  return { kind: 'args', args };
}

const laterCommands: ReadonlySet<string> = new Set(['install', 'doctor', 'hook']);

// The refusal of a command that is not in the table: one that comes in a later version, or none.
function refuseCommand(command: string): RefusalReason {
  return laterCommands.has(command)
    ? { kind: 'later-command', command }
    : { kind: 'unknown-command', command };
}

export interface CommandFlags {
  readonly command: string;

  // the flags a refusal of an unknown flag names, and the command's help line after `www`
  readonly taken: readonly string[];
  readonly line: string;
}

export interface CommandShapeInfo extends CommandFlags {
  // the numbers of arguments the command takes after its name
  readonly counts: readonly number[];
}

function toCommandFlags(command: string, shape: CommandShape): CommandFlags {
  return {
    command,
    taken: shape.flags.filter((flag) => !(shape.refused ?? []).includes(flag)),
    line: shape.line,
  };
}

// The parser's error on a joined command, or null when it parses.
function findParseError(argv: readonly string[]): unknown {
  try {
    parseArgs({ args: [...argv], options, strict: true, allowPositionals: true });

    return null;
  } catch (error) {
    return error;
  }
}

function toParseRefusal(error: unknown, argv: readonly string[]): RefusalReason {
  if (!(error instanceof Error) || !('code' in error)) {
    throw error;
  }

  // the option as the parser quotes it, whole, so the output's redaction sees every character of a
  // flag that holds a credential
  const flag =
    /^Unknown option '(?<option>-[^']*)'/u.exec(error.message)?.groups?.['option'] ??
    /--[A-Za-z][A-Za-z-]*/u.exec(error.message)?.[0] ??
    /-[A-Za-z]\b/u.exec(error.message)?.[0] ??
    '';

  const name = flag.replace(/^-+/u, '');

  return match(error.code)
    .with('ERR_PARSE_ARGS_UNKNOWN_OPTION', () => refuseUnknownFlag(argv, flag))
    .with('ERR_PARSE_ARGS_INVALID_OPTION_VALUE', (): RefusalReason =>
      isStringOption(name)
        ? { kind: 'flag-needs-value', flag: name }
        : { kind: 'flag-takes-no-value', flag: name },
    )
    .otherwise(() => {
      throw error;
    });
}

// A flag no command takes gets the refusal of its command, read leniently, so it names the flags
// that command takes. `www brief` is unknown, as in the strict read.
function refuseUnknownFlag(argv: readonly string[], flag: string): RefusalReason {
  const lenient = parseArgs({
    args: [...argv],
    options,
    strict: false,
    allowPositionals: true,
  });

  const [first] = lenient.positionals;

  // `-h` and `--help` with no command mean help, as in the strict read
  const command = first ?? (lenient.values.help === true ? 'help' : 'brief');
  const shape = commandShapes.get(command);

  return first === 'brief' || shape === undefined
    ? refuseCommand(command)
    : { kind: 'flag-not-taken', flag, ...toCommandFlags(command, shape) };
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

  const session = lenient.values.session;

  // `--session --help` names no session: the parser took the next flag as its value
  return typeof session === 'string' && !session.startsWith('-') ? session : null;
}

// Whether the command typed writes, read leniently so a refusal of any flag still knows.
export function isWriteArgv(argv: readonly string[]): boolean {
  const lenient = parseArgs({ args: [...argv], options, strict: false, allowPositionals: true });
  const [first] = lenient.positionals;
  const command = first ?? (lenient.values.help === true ? 'help' : 'brief');

  return isWriteCommand(command, lenient.values.paste === true);
}
