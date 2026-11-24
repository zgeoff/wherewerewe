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

const carriageReturnLineProblem =
  'the line holds a carriage return. Save the file with LF line endings.';

const oneLineProblem = 'the text must be one line, with no tab or newline.';

export function collectSessionProblems(
  hand: HandKeptStore,
  folderName: string,
  facts: Facts,
  openIDs: ReadonlyMap<string, number>,
): string[] {
  const pairs = new Map<string, string>();
  const keyedLines = new Map<string, number>();

  const lineProblems: { readonly line: number; readonly problems: string[] }[] = [];

  for (const entry of hand.session) {
    const clean = stripCarriageReturn(entry.text);
    const split = clean.indexOf('=');

    if (split >= 1) {
      pairs.set(clean.slice(0, split), clean.slice(split + 1));
      keyedLines.set(clean.slice(0, split), entry.line);
    }

    const problems = [
      ...(split < 1 ? ['the line is not key=value.'] : []),
      ...(entry.text.includes('\r') ? [carriageReturnLineProblem] : []),
    ];

    if (problems.length > 0) {
      lineProblems.push({ line: entry.line, problems });
    }
  }

  const keyed = new Map<string, string[]>();

  const addKeyProblem = (key: string, problem: string): void => {
    keyed.set(key, [...(keyed.get(key) ?? []), problem]);
  };

  for (const key of ['name', 'goal', 'started']) {
    if ((pairs.get(key) ?? '') === '') {
      addKeyProblem(key, 'the key is missing.');
    }
  }

  const name = pairs.get('name') ?? '';

  if (name !== '' && name !== folderName) {
    addKeyProblem(
      'name',
      `the name ${redactCredential(name)} is not the folder name ${folderName}.`,
    );
  }

  for (const key of pairs.keys()) {
    if (!handKeptSessionKeys.has(key) && !replacedSessionKeys.has(key)) {
      addKeyProblem(key, `format 1 has no key ${redactCredential(key)}. Remove the line.`);
    }
  }

  const goalProblem = findTextProblem(pairs.get('goal') ?? '', 200);
  const nowNextProblem = findTextProblem(pairs.get('now_next') ?? '', 120);

  if (goalProblem?.kind === 'not-one-line') {
    addKeyProblem('goal', oneLineProblem);
  }

  if (goalProblem?.kind === 'too-long') {
    addKeyProblem(
      'goal',
      `the goal is ${String(goalProblem.length)} characters, and the limit is 200.`,
    );
  }

  if (nowNextProblem?.kind === 'not-one-line') {
    addKeyProblem('now_next', oneLineProblem);
  }

  if (nowNextProblem?.kind === 'too-long') {
    addKeyProblem(
      'now_next',
      `the next step is ${String(nowNextProblem.length)} characters, and the limit is 120.`,
    );
  }

  for (const key of handKeptSessionKeys) {
    const label = findCredentialMatch(pairs.get(key) ?? '');

    if (label !== null) {
      addKeyProblem(key, `the text looks like a credential (it matches the ${label} pattern).`);
    }
  }

  const now = pairs.get('now') ?? '';

  const questionIDs = new Set(facts.questions.map((question) => question.id));

  if (now !== '' && !openIDs.has(now) && !questionIDs.has(now)) {
    addKeyProblem('now', `${redactCredential(now)} names no open item.`);
  }

  // A line that holds a carriage return and breaks another rule gets one line, not two.
  const carriageReturnLines = new Set(
    lineProblems
      .filter((entry) => entry.problems.includes(carriageReturnLineProblem))
      .map((entry) => entry.line),
  );

  const merged = new Set<number>();

  const keyedText = [...keyed].map(([key, problems]) => {
    const line = keyedLines.get(key);

    if (line !== undefined && carriageReturnLines.has(line)) {
      merged.add(line);

      return `session (${redactCredential(key)}): ${[...problems, carriageReturnLineProblem].join('; ')}`;
    }

    return `session (${redactCredential(key)}): ${problems.join('; ')}`;
  });

  return [
    ...lineProblems
      .filter((entry) => !merged.has(entry.line))
      .map((entry) => `session line ${String(entry.line)}: ${entry.problems.join('; ')}`),
    ...keyedText,
  ];
}
