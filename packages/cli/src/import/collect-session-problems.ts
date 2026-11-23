import { findCredentialMatch } from '../rules/find-credential-match.ts';
import { findTextProblem } from '../rules/find-text-problem.ts';
import { redactCredential } from '../rules/redact-credential.ts';
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

const oneLineProblem = 'the text must be one line, with no tab or newline.';

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

    if (split >= 1) {
      pairs.set(clean.slice(0, split), clean.slice(split + 1));
    }

    const problems = [
      ...(split < 1 ? ['the line is not key=value.'] : []),
      ...(entry.text.includes('\r')
        ? ['the line holds a carriage return. Save the file with LF line endings.']
        : []),
    ];

    if (problems.length > 0) {
      lineProblems.push(`session line ${String(entry.line)}: ${problems.join('; ')}`);
    }
  }

  const missing = ['name', 'goal', 'started']
    .filter((key) => (pairs.get(key) ?? '') === '')
    .map((key) => `session (${key}): the key is missing.`);

  const name = pairs.get('name') ?? '';

  const wrongName =
    name !== '' && name !== folderName
      ? [`session (name): the name ${redactCredential(name)} is not the folder name ${folderName}.`]
      : [];

  const unknown = [...pairs.keys()]
    .filter((key) => !handKeptSessionKeys.has(key) && !replacedSessionKeys.has(key))
    .map(
      (key) =>
        `session (${redactCredential(key)}): format 1 has no key ${redactCredential(key)}. Remove the line.`,
    );

  const goal = pairs.get('goal') ?? '';
  const nowNext = pairs.get('now_next') ?? '';
  const goalProblem = findTextProblem(goal, 200);
  const nowNextProblem = findTextProblem(nowNext, 120);

  const textProblems = [
    ...(goalProblem?.kind === 'not-one-line' ? [`session (goal): ${oneLineProblem}`] : []),
    ...(goalProblem?.kind === 'too-long'
      ? [
          `session (goal): the goal is ${String(goalProblem.length)} characters, and the limit is 200.`,
        ]
      : []),
    ...(nowNextProblem?.kind === 'not-one-line' ? [`session (now_next): ${oneLineProblem}`] : []),
    ...(nowNextProblem?.kind === 'too-long'
      ? [
          `session (now_next): the next step is ${String(nowNextProblem.length)} characters, and the limit is 120.`,
        ]
      : []),
  ];

  const credentials = [...handKeptSessionKeys].flatMap((key) => {
    const label = findCredentialMatch(pairs.get(key) ?? '');

    return label === null
      ? []
      : [`session (${key}): the text looks like a credential (it matches ${label}).`];
  });

  const now = pairs.get('now') ?? '';

  const questionIDs = new Set(facts.questions.map((question) => question.id));

  const nowProblem =
    now !== '' && !openIDs.has(now) && !questionIDs.has(now)
      ? [`session (now): ${redactCredential(now)} names no open item.`]
      : [];

  return [
    ...lineProblems,
    ...missing,
    ...wrongName,
    ...unknown,
    ...textProblems,
    ...credentials,
    ...nowProblem,
  ];
}
