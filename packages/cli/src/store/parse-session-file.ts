import type { Grant, SessionFile } from '../types.ts';

export type SessionParse =
  | { readonly kind: 'session'; readonly session: SessionFile }
  | { readonly kind: 'hand-kept' }
  | { readonly kind: 'format-1' }
  | { readonly kind: 'newer'; readonly format: string }
  | { readonly kind: 'broken'; readonly reason: string };

const knownKeys: ReadonlySet<string> = new Set([
  'format',
  'name',
  'goal',
  'grant',
  'grant_reading',
  'grant_where',
  'grant_set',
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

  let badLine: string | null = null;

  for (const line of text.split('\n')) {
    const split = line.indexOf('=');

    if (line !== '' && split > 0) {
      pairs.set(line.slice(0, split), line.slice(split + 1));
    } else if (line !== '' && badLine === null) {
      badLine = line;
    }
  }

  // The format line decides first: another format may write lines this one cannot read.
  const format = pairs.get('format');

  if (format === '0-by-hand' || (format === undefined && badLine === null)) {
    return { kind: 'hand-kept' };
  }

  if (format === '1') {
    return { kind: 'format-1' };
  }

  if (format !== undefined && format !== '2') {
    return { kind: 'newer', format };
  }

  if (badLine !== null) {
    return { kind: 'broken', reason: `the line "${badLine}" is not key=value` };
  }

  const unknownKey = [...pairs.keys()].find((key) => !knownKeys.has(key));

  if (unknownKey !== undefined) {
    return { kind: 'broken', reason: `the key ${unknownKey} is not in format 2` };
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

  const grant = parseGrant(pairs);

  if (typeof grant === 'string') {
    return { kind: 'broken', reason: grant };
  }

  return {
    kind: 'session',
    session: {
      format: '2',
      name,
      goal,
      grant,
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

const grantLimits = [
  { key: 'grant', limit: 700 },
  { key: 'grant_reading', limit: 200 },
  { key: 'grant_where', limit: 16 },
] as const;

// The four grant keys are all set or all empty. Returns a reason when they are neither, or when
// one is over its limit.
function parseGrant(pairs: ReadonlyMap<string, string>): Grant | string | null {
  const words = pairs.get('grant') ?? '';
  const reading = pairs.get('grant_reading') ?? '';
  const where = pairs.get('grant_where') ?? '';
  const set = pairs.get('grant_set') ?? '';
  const values = [words, reading, where, set];

  if (values.every((value) => value === '')) {
    return null;
  }

  if (values.some((value) => value === '')) {
    return 'the grant keys are not all set or all empty';
  }

  const over = grantLimits.find((entry) => [...(pairs.get(entry.key) ?? '')].length > entry.limit);

  if (over !== undefined) {
    return `the key ${over.key} is ${String([...(pairs.get(over.key) ?? '')].length)} characters, and the limit is ${String(over.limit)}`;
  }

  return { words, reading, where, set };
}

function toOptional(pairs: ReadonlyMap<string, string>, key: string): string | null {
  const value = pairs.get(key);

  return value === undefined || value === '' ? null : value;
}
