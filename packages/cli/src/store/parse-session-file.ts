import type { SessionFile } from '../types.ts';

export type SessionParse =
  | { readonly kind: 'session'; readonly session: SessionFile }
  | { readonly kind: 'hand-kept' }
  | { readonly kind: 'newer'; readonly format: string }
  | { readonly kind: 'broken'; readonly reason: string };

const knownKeys: ReadonlySet<string> = new Set([
  'format',
  'name',
  'goal',
  'started',
  'now',
  'now_next',
  'now_set',
  'last_write',
  'last_nudge',
  'imported_from',
]);

export function parseSessionFile(text: string): SessionParse {
  const pairs = new Map<string, string>();

  for (const line of text.split('\n')) {
    const split = line.indexOf('=');

    if (line !== '' && split > 0) {
      pairs.set(line.slice(0, split), line.slice(split + 1));
    } else if (line !== '') {
      return { kind: 'broken', reason: `the line "${line}" is not key=value` };
    }
  }

  const format = pairs.get('format');

  if (format === undefined || format === '0-by-hand') {
    return { kind: 'hand-kept' };
  }

  if (format !== '1') {
    return { kind: 'newer', format };
  }

  const unknownKey = [...pairs.keys()].find((key) => !knownKeys.has(key));

  if (unknownKey !== undefined) {
    return { kind: 'broken', reason: `the key ${unknownKey} is not in format 1` };
  }

  const name = pairs.get('name');
  const goal = pairs.get('goal');
  const started = pairs.get('started');

  if (name === undefined || name === '' || goal === undefined || goal === '') {
    return { kind: 'broken', reason: 'name and goal are required' };
  }

  if (started === undefined || started === '') {
    return { kind: 'broken', reason: 'started is required' };
  }

  return {
    kind: 'session',
    session: {
      format: '1',
      name,
      goal,
      started,
      now: toOptional(pairs, 'now'),
      nowNext: toOptional(pairs, 'now_next'),
      nowSet: toOptional(pairs, 'now_set'),
      lastWrite: toOptional(pairs, 'last_write'),
      lastNudge: toOptional(pairs, 'last_nudge'),
      importedFrom: toOptional(pairs, 'imported_from'),
    },
  };
}

function toOptional(pairs: ReadonlyMap<string, string>, key: string): string | null {
  const value = pairs.get(key);

  return value === undefined || value === '' ? null : value;
}
