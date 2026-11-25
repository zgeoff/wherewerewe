import { listCommandShapes, parseCLIArgs } from '../args/parse-cli-args.ts';
import type { RefusalReason, TextTarget } from '../types.ts';
import { buildParsedArgs } from './build-parsed-args.ts';

export interface RefusalSample {
  readonly title: string;
  readonly reason: RefusalReason;
}

type RefusalKind = RefusalReason['kind'];

type Found<Kind extends RefusalKind> = Extract<RefusalReason, { kind: Kind }>;

// At least one reason for each kind, so a new kind fails the type check until it has a sample.
type SamplesByKind = {
  readonly [Kind in RefusalKind]: readonly [Found<Kind>, ...Found<Kind>[]];
};

// One reason of each refusal kind, and a wrong number of arguments and a flag it does not take for
// each command, with plain values that match no credential pattern.
export function buildRefusalSamples(): RefusalSample[] {
  const name = 'tide-alerts';
  const task = buildParsedArgs(['task', 't-a', 'Write the parser']);
  const now = buildParsedArgs(['now', 't-a', 'run the tests', '--owed']);
  const set = buildParsedArgs(['set', 't-a', 'Write the lexer']);
  const done = buildParsedArgs(['done', 't-a', '--evidence', 'commit 4c1d2e0']);
  const drop = buildParsedArgs(['drop', 't-a', '--why', 'the plan changed']);
  const wait = buildParsedArgs(['wait', 'w-a', 'The staging key', '--who', 'wren']);
  const rule = buildParsedArgs(['rule', 'r-a', 'Show depths in metres']);
  const decide = buildParsedArgs(['decide', 'Use UTC', '--why', 'The feed sends UTC']);
  const use = buildParsedArgs(['use', 'ok-a', '--for', 'merged it']);
  const lesson = buildParsedArgs(['lesson', 'l-a', 'Reseed the table', '--why', 'stale']);
  const promise = buildParsedArgs(['promise', 'p-a', 'The table', '--to', 'sam', '--by', 'Friday']);
  const words = buildParsedArgs(['words', 'w-b', 'Keep PRs small', '--where', 'chat']);
  const init = buildParsedArgs(['init', name, '--goal', 'Ship it']);
  const importArgs = buildParsedArgs(['import', name]);

  const ok = buildParsedArgs(
    'ok ok-a --quote Merge --who jo --where slack --scope everywhere'.split(' '),
  );

  const grant = buildParsedArgs(
    'grant --may merge --where chat --reading covers-merges'.split(' '),
  );

  const flagNotTaken = collectParsedRefusals(
    listCommandShapes().map((shape) =>
      shape.command === 'brief' ? ['--bogus'] : [shape.command, '--bogus'],
    ),
    'flag-not-taken',
  );

  const wrongPositionals = collectParsedRefusals(
    listCommandShapes().map((shape) => [shape.command, 'zz-a', 'zz-b', 'zz-c', 'zz-d']),
    'wrong-positionals',
  );

  const claim: TextTarget = { label: 'claim', place: { positional: 1 } };

  const samples: SamplesByKind = {
    'no-store-folder': [{ kind: 'no-store-folder' }],
    'unknown-command': [{ kind: 'unknown-command', command: 'frob' }],
    'flag-needs-value': [{ kind: 'flag-needs-value', flag: 'note' }],
    'flag-value-has-dash': [
      {
        kind: 'flag-value-has-dash',
        flag: 'note',
        argv: ['now', 't-a', 'Go on', '--note=-costs $5 # "y"'],
      },
    ],
    'flag-takes-no-value': [{ kind: 'flag-takes-no-value', flag: 'owed' }],
    'flag-not-taken': [
      flagNotTaken[0] ?? invariantSample('flag-not-taken'),
      ...flagNotTaken.slice(1),
    ],
    'goal-paste-with-text': [{ kind: 'goal-paste-with-text' }],
    'no-grant-to-print': [{ kind: 'no-grant-to-print', name }],
    'wrong-positionals': [
      wrongPositionals[0] ?? invariantSample('wrong-positionals'),
      ...wrongPositionals.slice(1),
    ],
    'text-too-long': [
      { kind: 'text-too-long', args: task, target: claim, length: 152, limit: 120 },
    ],
    'text-not-one-line': [{ kind: 'text-not-one-line', args: task, target: claim }],
    'text-empty': [{ kind: 'text-empty', args: task, target: claim }],
    credential: [
      { kind: 'credential', args: task, target: claim, label: 'ghp', onOtherKind: false },
    ],
    'kind-full': [{ kind: 'kind-full', itemKind: 'task', oldestID: 't-old' }],
    'owed-needs-note': [{ kind: 'owed-needs-note', args: now }],
    'note-and-no-note': [{ kind: 'note-and-no-note', args: set }],
    'set-needs-change': [{ kind: 'set-needs-change', args: set }],
    'set-check-needs-claim': [{ kind: 'set-check-needs-claim', args: set }],
    'no-note-to-clear': [{ kind: 'no-note-to-clear', args: set, id: 't-a' }],
    'owed-note': [
      { kind: 'owed-note', args: done, id: 't-a', age: '2h', note: 'the parser tests' },
    ],
    'needs-evidence': [{ kind: 'needs-evidence', args: done }],
    'needs-reason': [{ kind: 'needs-reason', args: drop }],
    'needs-who': [{ kind: 'needs-who', args: wait }],
    'extra-has-separator': [
      { kind: 'extra-has-separator', args: ok, flag: 'who', value: 'jo;sam' },
    ],
    'ok-needs-parts': [{ kind: 'ok-needs-parts', args: ok, missing: ['scope'] }],
    'ok-standing': [{ kind: 'ok-standing', args: ok }],
    'grant-needs-part': [{ kind: 'grant-needs-part', args: grant }],
    'grant-reading-no-grant': [{ kind: 'grant-reading-no-grant', args: grant, name }],
    'grant-words-too-long': [{ kind: 'grant-words-too-long', args: grant, length: 800 }],
    'grant-too-many-bullets': [{ kind: 'grant-too-many-bullets', args: grant, count: 13 }],
    'grant-too-many-lines': [{ kind: 'grant-too-many-lines', args: grant, lines: 20 }],
    'text-has-mark': [{ kind: 'text-has-mark', args: task, target: claim, text: 'Write • it' }],
    'decide-needs-why': [{ kind: 'decide-needs-why', args: decide }],
    'bad-decision-who': [{ kind: 'bad-decision-who', args: decide }],
    'no-such-decision': [{ kind: 'no-such-decision', value: 'd-9', lastNumber: 2 }],
    'decision-numbers-used-up': [{ kind: 'decision-numbers-used-up', lastNumber: 999 }],
    'decision-is-owners': [{ kind: 'decision-is-owners', id: 'd-1' }],
    'on-unknown': [{ kind: 'on-unknown', args: decide, id: 't-z', openIDs: ['t-a'] }],
    'owner-only': [{ kind: 'owner-only' }],
    'owner-notes-full': [{ kind: 'owner-notes-full', name, oldestID: 'o-1' }],
    'owner-note-numbers-used-up': [{ kind: 'owner-note-numbers-used-up', lastNumber: 999 }],
    'owner-note-unknown': [{ kind: 'owner-note-unknown', name, id: 'o-9', shownIDs: ['o-1'] }],
    'bad-since': [
      { kind: 'bad-since', command: 'recap' },
      { kind: 'bad-since', command: 'log' },
    ],
    'use-needs-for': [{ kind: 'use-needs-for', args: use }],
    'use-not-approval': [{ kind: 'use-not-approval', id: 't-a', itemKind: 'task' }],
    'no-open-item': [{ kind: 'no-open-item', args: done, id: 't-z', openIDs: ['t-a'] }],
    'closed-id': [{ kind: 'closed-id', args: task, id: 't-a', day: 3 }],
    'other-kind': [{ kind: 'other-kind', args: task, id: 't-a', itemKind: 'wait' }],
    'bad-list-kind': [{ kind: 'bad-list-kind' }],
    'lesson-needs-why': [{ kind: 'lesson-needs-why', args: lesson }],
    'promise-needs-parts': [{ kind: 'promise-needs-parts', args: promise, missing: ['to'] }],
    'promise-separator': [
      { kind: 'promise-separator', args: promise, flag: 'to', value: 'sam;jo' },
    ],
    'words-needs-where': [{ kind: 'words-needs-where', args: words }],
    'close-kind': [{ kind: 'close-kind', id: 'l-a', itemKind: 'lesson' }],
    'id-held-twice': [
      {
        kind: 'id-held-twice',
        name,
        id: 't-a',
        first: 'items.tsv',
        second: 'lessons.tsv',
        path: '/srv/tide alerts/lessons.tsv',
      },
    ],
    'bad-id': [{ kind: 'bad-id', args: task, id: 'T A' }],
    'too-many-checks': [{ kind: 'too-many-checks', args: task, firstFlag: 'pr' }],
    'malformed-check': [{ kind: 'malformed-check', args: task, flag: 'pr' }],
    'check-not-one-line': [{ kind: 'check-not-one-line', args: task, flag: 'path' }],
    'relative-path': [
      { kind: 'relative-path', args: task, flag: 'path', absolute: '/work/parser notes.md' },
    ],
    'rule-has-check': [{ kind: 'rule-has-check', args: rule }],
    'blocked-by-unknown': [
      { kind: 'blocked-by-unknown', args: task, blockedBy: 't-z', openIDs: ['t-a'] },
    ],
    'session-exists': [{ kind: 'session-exists', name }],
    'needs-goal': [{ kind: 'needs-goal', args: init }],
    'bad-session-name': [{ kind: 'bad-session-name', args: init, name: 'Tide' }],
    'attach-no-session': [{ kind: 'attach-no-session', name, sessions: ['tide-chart'] }],
    'no-agent-id': [
      { kind: 'no-agent-id', name },
      { kind: 'no-agent-id', name: null },
    ],
    'detach-no-binding': [{ kind: 'detach-no-binding', harness: 'claude' }],
    'lock-busy': [{ kind: 'lock-busy', args: task, name, pid: 4242 }],
    'no-session': [
      { kind: 'no-session', named: name, sessions: [{ name: 'tide-chart', day: 2 }] },
      { kind: 'no-session', named: null, sessions: [] },
    ],
    'import-no-session': [{ kind: 'import-no-session', name, sessions: [] }],
    'import-already-format-2': [{ kind: 'import-already-format-2', name, hasAgent: false }],
    'upgrade-refused': [
      {
        kind: 'upgrade-refused',
        args: importArgs,
        name,
        rowProblems: [],
        problems: [{ kind: 'drop-unknown', id: 'ok-z', open: ['ok-a'] }],
      },
    ],
    'hand-kept': [{ kind: 'hand-kept', name }],
    'format-1': [{ kind: 'format-1', name }],
    newer: [{ kind: 'newer', name, format: '3' }],
    'broken-store': [
      {
        kind: 'broken-store',
        name,
        file: 'items.tsv',
        path: '/srv/tide alerts/items.tsv',
        line: 4,
        reason: 'expected 8 tab-separated columns, found 7',
      },
    ],
  };

  return Object.values(samples).flatMap((reasons: readonly RefusalReason[]) =>
    reasons.map((reason, at) => ({ title: buildTitle(reason, at), reason })),
  );
}

// The refusal the parser gives each argv, when it is of the kind.
function collectParsedRefusals<Kind extends RefusalKind>(
  argvs: readonly (readonly string[])[],
  kind: Kind,
): Found<Kind>[] {
  return argvs.flatMap((argv) => {
    const parsed = parseCLIArgs(argv);

    return parsed.kind === 'refused' && isKind(parsed.reason, kind) ? [parsed.reason] : [];
  });
}

function isKind<Kind extends RefusalKind>(
  reason: RefusalReason,
  kind: Kind,
): reason is Found<Kind> {
  return reason.kind === kind;
}

function invariantSample(kind: RefusalKind): never {
  throw new Error(`the parser gave no ${kind} refusal`);
}

function buildTitle(reason: RefusalReason, at: number): string {
  return 'command' in reason
    ? `${reason.kind} of ${reason.command} ${at + 1}`
    : `${reason.kind} ${at + 1}`;
}
