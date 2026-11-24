import { redactCredential } from '../rules/redact-credential.ts';
import type { ParsedArgs, TypedFlag } from '../types.ts';

export interface RunSpec {
  readonly replacePositional: (index: number, value: string) => RunSpec;
  readonly addPositional: (value: string) => RunSpec;
  readonly replaceFlag: (name: string, value: string) => RunSpec;
  readonly addFlag: (name: string, value: string) => RunSpec;
  readonly addFlagBefore: (beforeName: string, name: string, value: string) => RunSpec;
  readonly addWord: (word: string) => RunSpec;
  readonly keepFlags: (names: readonly string[]) => RunSpec;
  readonly keepCheckFlags: () => RunSpec;
  readonly keepFirstCheck: () => RunSpec;
  readonly dropFlag: (name: string) => RunSpec;
  readonly renameCommand: (command: string) => RunSpec;
  readonly toArgv: () => string[];
}

// The refused command as typed, without --session, that a refusal edits into its Run line. A flag
// typed twice counts at its last value, as the parser reads it, so a replaced flag keeps one copy.
export function buildRunSpec(args: ParsedArgs): RunSpec {
  return makeSpec({
    command: args.command,
    positionals: args.positionals.map((word) => redactCredential(word)),
    flags: args.flags.map((flag) => ({
      name: flag.name,
      value: flag.value === null ? null : redactCredential(flag.value),
    })),
    words: [],
  });
}

const checkFlagNames: ReadonlySet<string> = new Set(['pr', 'branch', 'path', 'pid']);

interface SpecState {
  readonly command: string;
  readonly positionals: readonly string[];
  readonly flags: readonly TypedFlag[];

  // bare words that end the command, such as a placeholder for a choice of two flags
  readonly words: readonly string[];
}

function makeSpec(state: SpecState): RunSpec {
  return {
    replacePositional: (index, value) =>
      makeSpec({
        ...state,
        positionals: state.positionals.map((word, at) => (at === index ? value : word)),
      }),
    addPositional: (value) => makeSpec({ ...state, positionals: [...state.positionals, value] }),
    replaceFlag: (name, value) => {
      const last = state.flags.findLastIndex((flag) => flag.name === name);

      return makeSpec({
        ...state,
        flags: state.flags.flatMap((flag, at) => {
          if (flag.name !== name) {
            return [flag];
          }

          return at === last ? [{ name, value }] : [];
        }),
      });
    },
    addFlag: (name, value) => makeSpec({ ...state, flags: [...state.flags, { name, value }] }),
    addFlagBefore: (beforeName, name, value) => {
      const at = state.flags.findIndex((flag) => flag.name === beforeName);

      return makeSpec({
        ...state,
        flags:
          at === -1
            ? [...state.flags, { name, value }]
            : [...state.flags.slice(0, at), { name, value }, ...state.flags.slice(at)],
      });
    },
    addWord: (word) => makeSpec({ ...state, words: [...state.words, word] }),
    keepFlags: (names) =>
      makeSpec({ ...state, flags: state.flags.filter((flag) => names.includes(flag.name)) }),
    keepCheckFlags: () =>
      makeSpec({
        ...state,
        flags: state.flags.filter((flag) => checkFlagNames.has(flag.name)),
      }),
    keepFirstCheck: () => {
      const first = state.flags.find((flag) => checkFlagNames.has(flag.name));

      return makeSpec({
        ...state,
        flags: state.flags.filter((flag) => !checkFlagNames.has(flag.name) || flag === first),
      });
    },
    dropFlag: (name) =>
      makeSpec({ ...state, flags: state.flags.filter((flag) => flag.name !== name) }),
    renameCommand: (command) => makeSpec({ ...state, command }),
    toArgv: () => buildArgv(state),
  };
}

// A positional that starts with a dash goes after `--`, which ends the flags.
function buildArgv(state: SpecState): string[] {
  const words = [...(state.command === 'brief' ? [] : [state.command]), ...state.positionals];
  const flagWords = state.flags.flatMap((flag) => buildFlagWords(flag));

  return words.some((word) => word.startsWith('-'))
    ? [...flagWords, ...state.words, '--', ...words]
    : [...words, ...flagWords, ...state.words];
}

// The parser reads `--quote --preview` as a flag with no value, and `--quote=--preview` as the value.
function buildFlagWords(flag: TypedFlag): string[] {
  if (flag.value === null) {
    return [`--${flag.name}`];
  }

  return flag.value.startsWith('-')
    ? [`--${flag.name}=${flag.value}`]
    : [`--${flag.name}`, flag.value];
}
