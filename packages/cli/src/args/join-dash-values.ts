import { redactCredential } from '../rules/redact-credential.ts';

export interface JoinedDashValues {
  // the first flag whose value starts with a dash
  readonly flag: string;

  // the command as typed, without --session, with each such flag and its value joined by =
  readonly argv: readonly string[];
}

// The parser reads `--never "--admin"` as a flag with no value, and `--never=--admin` as the value,
// so this joins each flag that takes text to a next word that starts with a dash. A word that names
// one of www's own flags stays a flag. Null when nothing needs joining.
export function joinDashValues(
  argv: readonly string[],
  flagTypes: ReadonlyMap<string, 'string' | 'boolean'>,
): JoinedDashValues | null {
  const isTextFlag = (name: string): boolean => flagTypes.get(name) === 'string';
  const joined: string[] = [];
  const flags: string[] = [];
  let index = 0;

  while (index < argv.length) {
    const word = argv[index] ?? '';
    const next = argv[index + 1];
    const name = word.startsWith('--') ? word.slice(2) : '';

    if (word === '--') {
      joined.push(...argv.slice(index));
      break;
    }

    if (name !== '' && !name.includes('=') && isTextFlag(name) && next !== undefined) {
      const isJoined = isDashValue(next, flagTypes);

      if (isJoined) {
        flags.push(name);
      }

      joined.push(...(isJoined ? [`${word}=${next}`] : [word, next]));

      index += 2;
    } else {
      joined.push(word);

      index += 1;
    }
  }

  const [flag] = flags;

  return flag === undefined
    ? null
    : { flag, argv: dropSession(joined).map((word) => redactCredential(word)) };
}

// A lone `-` is a value to the parser, and so is a word with no dash in front. A word that names
// one of www's flags, such as --where or -h, stays that flag.
function isDashValue(word: string, flagTypes: ReadonlyMap<string, 'string' | 'boolean'>): boolean {
  if (word.length < 2 || !word.startsWith('-')) {
    return false;
  }

  const name = word.startsWith('--') ? (word.slice(2).split('=')[0] ?? '') : '';

  return word !== '-h' && !flagTypes.has(name);
}

// A refusal's Run line adds --session back when the command was typed with it.
function dropSession(words: readonly string[]): string[] {
  const end = words.indexOf('--');
  const flagWords = end === -1 ? words : words.slice(0, end);
  const rest = end === -1 ? [] : words.slice(end);

  const kept = flagWords.filter(
    (word, at) =>
      word !== '--session' && !word.startsWith('--session=') && flagWords[at - 1] !== '--session',
  );

  return [...kept, ...rest];
}
