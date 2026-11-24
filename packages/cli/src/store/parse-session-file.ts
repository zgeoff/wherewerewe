import { countGrantWords } from '../rules/count-grant-words.ts';
import { findCredentialMatch } from '../rules/find-credential-match.ts';
import { findTextProblem } from '../rules/find-text-problem.ts';
import { grantLimits } from '../rules/grant-limits.ts';
import { isUTCTime } from '../rules/is-utc-time.ts';
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
  'grant_may',
  'grant_not',
  'grant_never',
  'grant_scope',
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

const bulletKeys: ReadonlySet<string> = new Set(['grant_may', 'grant_not', 'grant_never']);

export function parseSessionFile(text: string): SessionParse {
  const pairs = new Map<string, string>();
  const bullets = new Map<string, string[]>();

  let badLine: string | null = null;
  let repeatedKey: string | null = null;

  for (const line of text.split('\n')) {
    const split = line.indexOf('=');
    const key = line.slice(0, split);

    if (line !== '' && split > 0 && bulletKeys.has(key)) {
      bullets.set(key, [...(bullets.get(key) ?? []), line.slice(split + 1)]);
    } else if (line !== '' && split > 0) {
      repeatedKey ??= pairs.has(key) ? key : null;

      pairs.set(key, line.slice(split + 1));
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

  if (repeatedKey !== null) {
    return { kind: 'broken', reason: `the key ${repeatedKey} repeats` };
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

  const grant = parseGrant(pairs, bullets);

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

// A grant has at least one grant_may line and sets grant_reading, grant_where and grant_set; with
// no grant, the file has no bullet lines and those keys and grant_scope are empty. Returns a reason
// when the keys are neither, or when a value holds what www grant refuses.
function parseGrant(
  pairs: ReadonlyMap<string, string>,
  bullets: ReadonlyMap<string, readonly string[]>,
): Grant | string | null {
  const may = bullets.get('grant_may') ?? [];
  const not = bullets.get('grant_not') ?? [];
  const never = bullets.get('grant_never') ?? [];
  const scope = pairs.get('grant_scope') ?? '';
  const reading = pairs.get('grant_reading') ?? '';
  const where = pairs.get('grant_where') ?? '';
  const set = pairs.get('grant_set') ?? '';
  const all = [...may, ...not, ...never];

  if (all.length === 0 && [scope, reading, where, set].every((value) => value === '')) {
    return null;
  }

  if (may.length === 0 || [reading, where, set].some((value) => value === '')) {
    return 'a grant needs a grant_may line and grant_reading, grant_where and grant_set';
  }

  const textProblem = findGrantTextProblem([
    ...all.map((bullet) => ({ name: 'a grant bullet', value: bullet, limit: grantLimits.bullet })),
    ...(scope === ''
      ? []
      : [{ name: 'the key grant_scope', value: scope, limit: grantLimits.scope }]),
    { name: 'the key grant_reading', value: reading, limit: grantLimits.reading },
    { name: 'the key grant_where', value: where, limit: grantLimits.where },
  ]);

  if (textProblem !== null) {
    return textProblem;
  }

  if (all.some((bullet) => bullet.includes('•'))) {
    return 'a grant bullet holds •';
  }

  if (/[;=]/u.test(where)) {
    return 'the key grant_where holds ; or =';
  }

  if (!isUTCTime(set)) {
    return 'the key grant_set is not a UTC time';
  }

  if (all.length > grantLimits.bullets) {
    return `the grant has ${String(all.length)} bullets, and the limit is ${String(grantLimits.bullets)}`;
  }

  const words = { may, not, never, scope: scope === '' ? null : scope };
  const count = countGrantWords(words);

  if (count > grantLimits.words) {
    return `the grant's words are ${String(count)} characters, and the limit is ${String(grantLimits.words)}`;
  }

  return { ...words, reading, where, set };
}

interface GrantText {
  // how the reason names the value, such as the key grant_where
  readonly name: string;
  readonly value: string;
  readonly limit: number;
}

// The first problem a write would refuse in one of the grant's texts. A reason never quotes the
// value, so a credential stays off the terminal.
function findGrantTextProblem(texts: readonly GrantText[]): string | null {
  for (const text of texts) {
    const problem = findTextProblem(text.value, text.limit);

    if (problem?.kind === 'empty') {
      return `${text.name} is empty`;
    }

    if (problem?.kind === 'not-one-line') {
      return `${text.name} holds a tab or a line break`;
    }

    if (problem?.kind === 'too-long') {
      return `${text.name} is ${String(problem.length)} characters, and the limit is ${String(text.limit)}`;
    }

    const label = findCredentialMatch(text.value);

    if (label !== null) {
      return `${text.name} looks like a credential (it matches ${label})`;
    }
  }

  return null;
}

function toOptional(pairs: ReadonlyMap<string, string>, key: string): string | null {
  const value = pairs.get(key);

  return value === undefined || value === '' ? null : value;
}
