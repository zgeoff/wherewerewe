import type { ParsedArgs, TypedFlag } from '../types.ts';

export interface RunSpec {
  readonly replacePositional: (index: number, value: string) => RunSpec;
  readonly replaceFlag: (name: string, value: string) => RunSpec;
  readonly addFlag: (name: string, value: string) => RunSpec;
  readonly keepFlags: (names: readonly string[]) => RunSpec;
  readonly keepCheckFlags: () => RunSpec;
  readonly keepFirstCheck: () => RunSpec;
  readonly dropFlag: (name: string) => RunSpec;
  readonly renameCommand: (command: string) => RunSpec;
  readonly toArgv: () => string[];
}

// The refused command as typed, without --session, that a refusal edits into its Run line.
export function buildRunSpec(args: ParsedArgs): RunSpec {
  return makeSpec({ command: args.command, positionals: args.positionals, flags: args.flags });
}

const checkFlagNames: ReadonlySet<string> = new Set(['pr', 'branch', 'path', 'pid']);

interface SpecState {
  readonly command: string;
  readonly positionals: readonly string[];
  readonly flags: readonly TypedFlag[];
}

function makeSpec(state: SpecState): RunSpec {
  return {
    replacePositional: (index, value) =>
      makeSpec({
        ...state,
        positionals: state.positionals.map((word, at) => (at === index ? value : word)),
      }),
    replaceFlag: (name, value) => {
      const index = state.flags.findIndex((flag) => flag.name === name);

      return makeSpec({
        ...state,
        flags: state.flags.map((flag, at) => (at === index ? { name, value } : flag)),
      });
    },
    addFlag: (name, value) => makeSpec({ ...state, flags: [...state.flags, { name, value }] }),
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

  const flagWords = state.flags.flatMap((flag) =>
    flag.value === null ? [`--${flag.name}`] : [`--${flag.name}`, flag.value],
  );

  return words.some((word) => word.startsWith('-'))
    ? [...flagWords, '--', ...words]
    : [...words, ...flagWords];
}
