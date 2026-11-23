import { findCredentialMatch } from '../rules/find-credential-match.ts';
import type { HandKeptStore } from './parse-hand-kept-store.ts';
import { stripCarriageReturn } from './strip-carriage-return.ts';
import type { Facts } from './types.ts';

const handKeptSessionKeys: ReadonlySet<string> = new Set([
  'name',
  'goal',
  'started',
  'now',
  'now_next',
  'now_set',
]);

const replacedSessionKeys: ReadonlySet<string> = new Set([
  'format',
  'last_write',
  'last_nudge',
  'imported_from',
]);

export function collectSessionProblems(
  hand: HandKeptStore,
  folderName: string,
  facts: Facts,
  openIDs: ReadonlyMap<string, number>,
): string[] {
  const pairs = new Map<string, string>();

  const lineProblems: string[] = [];

  for (const entry of hand.session) {
    const clean = stripCarriageReturn(entry.text);
    const split = clean.indexOf('=');
    const line = String(entry.line);

    if (split < 1) {
      lineProblems.push(`session line ${line}: the line is not key=value.`);
    } else {
      pairs.set(clean.slice(0, split), clean.slice(split + 1));
    }

    if (entry.text.includes('\r')) {
      lineProblems.push(
        `session line ${line}: the line holds a carriage return. Save the file with LF line endings.`,
      );
    }
  }

  const missing = ['name', 'goal', 'started']
    .filter((key) => (pairs.get(key) ?? '') === '')
    .map((key) => `session (${key}): the key is missing.`);

  const name = pairs.get('name') ?? '';

  const wrongName =
    name !== '' && name !== folderName
      ? [`session (name): the name ${name} is not the folder name ${folderName}.`]
      : [];

  const unknown = [...pairs.keys()]
    .filter((key) => !handKeptSessionKeys.has(key) && !replacedSessionKeys.has(key))
    .map((key) => `session (${key}): format 1 has no key ${key}. Remove the line.`);

  const goal = pairs.get('goal') ?? '';
  const nowNext = pairs.get('now_next') ?? '';
  const goalLength = [...goal].length;
  const nowNextLength = [...nowNext].length;

  const lengthProblems = [
    ...(goalLength > 200
      ? [`session (goal): the goal is ${String(goalLength)} characters, and the limit is 200.`]
      : []),
    ...(nowNextLength > 120
      ? [
          `session (now_next): the next step is ${String(nowNextLength)} characters, and the limit is 120.`,
        ]
      : []),
  ];

  const credentials = [
    ['goal', goal],
    ['now_next', nowNext],
  ].flatMap(([key, text]) => {
    const label = findCredentialMatch(text ?? '');

    return label === null
      ? []
      : [`session (${key ?? ''}): the text looks like a credential (it matches ${label}).`];
  });

  const now = pairs.get('now') ?? '';

  const questionIDs = new Set(facts.questions.map((question) => question.id));

  const nowProblem =
    now !== '' && !openIDs.has(now) && !questionIDs.has(now)
      ? [`session (now): ${now} names no open item.`]
      : [];

  return [
    ...lineProblems,
    ...missing,
    ...wrongName,
    ...unknown,
    ...lengthProblems,
    ...credentials,
    ...nowProblem,
  ];
}
