import type { ParsedArgs, RunWord } from '../types.ts';
import { toRedactedRunWord } from './to-redacted-run-word.ts';

export interface RunSpec {
  readonly replacePositional: (index: number, value: RunWord) => RunSpec;
  readonly addPositional: (value: RunWord) => RunSpec;
  readonly replaceFlag: (name: string, value: RunWord) => RunSpec;
  readonly replaceFlagAt: (name: string, occurrence: number, value: RunWord) => RunSpec;
  readonly addFlag: (name: string, value: RunWord) => RunSpec;
  readonly addFlagBefore: (beforeName: string, name: string, value: RunWord) => RunSpec;
  readonly addWord: (word: RunWord) => RunSpec;
  readonly keepFlags: (names: readonly string[]) => RunSpec;
  readonly keepCheckAndNoteFlags: () => RunSpec;
  readonly keepFirstCheck: () => RunSpec;
  readonly dropFlag: (name: string) => RunSpec;
  readonly dropFlagValue: (name: string, value: RunWord) => RunSpec;
  readonly renameCommand: (command: string) => RunSpec;
  readonly toArgv: () => RunWord[];
}

// The refused command as typed, without --session, that a refusal edits into its Run line. A flag
// typed twice counts at its last value, as the parser reads it, so a replaced flag keeps one copy.
export function buildRunSpec(args: ParsedArgs): RunSpec {
  return makeSpec({
    command: args.command,
    positionals: args.positionals.map((word) => toRedactedRunWord(word)),
    flags: args.flags.map((flag) => ({
      name: flag.name,
      value: flag.value === null ? null : toRedactedRunWord(flag.value),
    })),
    words: [],
  });
}

const checkFlagNames: ReadonlySet<string> = new Set(['pr', 'branch', 'path', 'pid']);
const keptFlagNames: ReadonlySet<string> = new Set([...checkFlagNames, 'note', 'owed']);

interface SpecFlag {
  readonly name: string;
  readonly value: RunWord | null;
}

interface SpecState {
  readonly command: string;
  readonly positionals: readonly RunWord[];
  readonly flags: readonly SpecFlag[];

  // bare words that end the command, such as a placeholder for a choice of two flags
  readonly words: readonly RunWord[];
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
    replaceFlagAt: (name, occurrence, value) => {
      const places = state.flags.flatMap((flag, at) => (flag.name === name ? [at] : []));
      const place = places.at(occurrence);

      return makeSpec({
        ...state,
        flags: state.flags.map((flag, at) => (at === place ? { name, value } : flag)),
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
    keepCheckAndNoteFlags: () =>
      makeSpec({
        ...state,
        flags: state.flags.filter((flag) => keptFlagNames.has(flag.name)),
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
    dropFlagValue: (name, value) =>
      makeSpec({
        ...state,
        flags: state.flags.filter(
          (flag) => flag.name !== name || flag.value === null || !isSameRunWord(flag.value, value),
        ),
      }),
    renameCommand: (command) => makeSpec({ ...state, command }),
    toArgv: () => buildArgv(state),
  };
}

function isSameRunWord(first: RunWord, second: RunWord): boolean {
  if (typeof first === 'string' || typeof second === 'string') {
    return first === second;
  }

  return first.placeholder === second.placeholder;
}

// A positional that starts with a dash goes after `--`, which ends the flags.
function buildArgv(state: SpecState): RunWord[] {
  const words = [...(state.command === 'brief' ? [] : [state.command]), ...state.positionals];
  const flagWords = state.flags.flatMap((flag) => buildFlagWords(flag));

  return words.some((word) => typeof word === 'string' && word.startsWith('-'))
    ? [...flagWords, ...state.words, '--', ...words]
    : [...words, ...flagWords, ...state.words];
}

// The parser reads `--quote --preview` as a flag with no value, and `--quote=--preview` as the value.
function buildFlagWords(flag: SpecFlag): RunWord[] {
  if (flag.value === null) {
    return [`--${flag.name}`];
  }

  return typeof flag.value === 'string' && flag.value.startsWith('-')
    ? [`--${flag.name}=${flag.value}`]
    : [`--${flag.name}`, flag.value];
}
