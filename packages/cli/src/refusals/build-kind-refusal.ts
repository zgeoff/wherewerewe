import { match } from 'ts-pattern';
import { getKindWord } from '../rules/get-kind-word.ts';
import { itemCaps, lessonCap, promiseCap, wordsCap } from '../rules/item-caps.ts';
import type { Kind, Refusal, RefusalReason, RunWord } from '../types.ts';
import { buildRunSpec } from './build-run-spec.ts';
import { refuse } from './refuse.ts';
import { runPlaceholders } from './run-placeholders.ts';
import { toPlaceholder } from './to-placeholder.ts';

type Found<Variant extends RefusalReason['kind']> = Extract<RefusalReason, { kind: Variant }>;

type KindRefusalReason = Found<
  | 'kind-full'
  | 'other-kind'
  | 'lesson-needs-why'
  | 'promise-needs-parts'
  | 'promise-separator'
  | 'words-needs-where'
  | 'close-kind'
  | 'id-held-twice'
>;

const promisePlaceholders = { to: '<who>', by: '<when>' } as const;

// The refusals about a kind of item or row: its cap, an id that holds another kind, the parts a
// lesson, a promise or the owner's words need, a close the kind does not take, and an id that two
// files hold.
export function buildKindRefusal(reason: KindRefusalReason): Refusal {
  return match(reason)
    .with({ kind: 'kind-full' }, (found) => buildKindFull(found))
    .with({ kind: 'other-kind' }, (found) => buildOtherKind(found))
    .with({ kind: 'lesson-needs-why' }, (found) =>
      refuse(
        'www: refused: a lesson needs the mistake behind it.',
        buildRunSpec(found.args).addFlag('why', toPlaceholder('<the mistake behind it>')).toArgv(),
      ),
    )
    .with({ kind: 'promise-needs-parts' }, (found) =>
      refuse(
        'www: refused: a promise names who gets it and when.',
        found.missing
          .reduce(
            (spec, flag) => spec.addFlag(flag, toPlaceholder(promisePlaceholders[flag])),
            buildRunSpec(found.args),
          )
          .toArgv(),
      ),
    )
    .with({ kind: 'promise-separator' }, (found) =>
      refuse(
        `www: refused: --${found.flag} cannot hold ; or =, which the journal keeps apart.`,
        buildRunSpec(found.args).replaceFlag(found.flag, fixSeparator(found)).toArgv(),
      ),
    )
    .with({ kind: 'words-needs-where' }, (found) =>
      refuse("www: refused: the owner's words need where they were said.", [
        'words',
        found.args.positionals[0] ?? runPlaceholders.newID,
        toPlaceholder("<the owner's exact words>"),
        '--where',
        toPlaceholder('<where>'),
      ]),
    )
    .with({ kind: 'close-kind' }, (found) =>
      refuse(formatCloseKind(found), ['drop', found.id, '--why', runPlaceholders.reason]),
    )
    .with({ kind: 'id-held-twice' }, (found): Refusal => ({
      exitCode: 3,
      lines: [
        `www: refused: ${found.name} holds ${found.id} twice, as ${found.first} and as ${found.second}. Rename one of them by hand; the journal keeps both.`,
      ],
      runs: [{ shell: ['less', found.path] }],
    }))
    .exhaustive();
}

const capWords = {
  ok: { cap: itemCaps.ok, plural: 'one-time approvals' },
  task: { cap: itemCaps.task, plural: 'tasks' },
  wait: { cap: itemCaps.wait, plural: 'waits' },
  rule: { cap: itemCaps.rule, plural: 'rules' },
  where: { cap: itemCaps.where, plural: 'where items' },
  lesson: { cap: lessonCap, plural: 'lessons' },
  promise: { cap: promiseCap, plural: 'promises' },
  words: { cap: wordsCap, plural: "owner's words" },
} as const;

function buildKindFull(found: Found<'kind-full'>): Refusal {
  const cap = capWords[found.itemKind].cap;
  const plural = capWords[found.itemKind].plural;

  const argv = match(found.itemKind)
    .with('ok', (): RunWord[] => ['use', found.oldestID, '--for', runPlaceholders.what])
    .with('rule', 'lesson', 'words', (): RunWord[] => [
      'drop',
      found.oldestID,
      '--why',
      runPlaceholders.reason,
    ])
    .with('task', 'wait', 'where', 'promise', (): RunWord[] => [
      'done',
      found.oldestID,
      '--evidence',
      runPlaceholders.evidence,
    ])
    .exhaustive();

  const advice = match(found.itemKind)
    .with('ok', () => 'Spend it with www use, or drop it.')
    .with('lesson', () => 'Drop one, or replace one with www lesson.')
    .with('words', () => 'Drop one, or replace one with www words.')
    .with('promise', () => 'Close one, or replace one with www promise.')
    .with('task', 'wait', 'rule', 'where', () => 'Close one, or replace one with www set.')
    .exhaustive();

  return refuse(
    `www: refused: the session holds ${String(cap)} of ${String(cap)} ${plural}. ${advice}`,
    argv,
  );
}

// An id that holds a lesson, a promise or the owner's words names the command that writes that kind,
// because set writes only items.tsv.
function buildOtherKind(found: Found<'other-kind'>): Refusal {
  return match(found.itemKind)
    .with('lesson', () =>
      refuse(
        `www: refused: ${found.id} is a lesson. Change it with www lesson, or pick a new id.`,
        [
          'lesson',
          found.id,
          toPlaceholder('<do this>'),
          '--why',
          toPlaceholder('<the mistake behind it>'),
        ],
      ),
    )
    .with('promise', () =>
      refuse(
        `www: refused: ${found.id} is a promise. Change it with www promise, or pick a new id.`,
        [
          'promise',
          found.id,
          toPlaceholder('<what>'),
          '--to',
          toPlaceholder('<who>'),
          '--by',
          toPlaceholder('<when>'),
        ],
      ),
    )
    .with('words', () =>
      refuse(
        `www: refused: ${found.id} holds the owner's words. Change them with www words, or pick a new id.`,
        [
          'words',
          found.id,
          toPlaceholder("<the owner's exact words>"),
          '--where',
          toPlaceholder('<where>'),
        ],
      ),
    )
    .with('task', 'wait', 'ok', 'rule', 'where', (kind) =>
      refuse(
        `www: refused: ${found.id} is a ${getKindWord(kind)}. Change its text with set, or pick a new id.`,
        buildOtherKindRun({ ...found, itemKind: kind }),
      ),
    )
    .exhaustive();
}

// A rule has no check, so the set that turns the claim into a rule's new text drops the flags.
function buildOtherKindRun(found: Found<'other-kind'> & { readonly itemKind: Kind }): RunWord[] {
  const typed = buildRunSpec(found.args);

  // ok takes its words in --quote, so the set that replaces it takes them as the claim
  const spec = (
    found.args.command === 'ok'
      ? typed
          .keepFlags(['note', 'owed'])
          .addPositional(found.args.values.quote ?? runPlaceholders.claim)
      : typed
  ).renameCommand('set');

  return match(found.itemKind)
    .with('rule', () => spec.keepFlags(['note', 'owed']).toArgv())
    .with('task', 'wait', 'ok', 'where', () => spec.keepCheckAndNoteFlags().toArgv())
    .exhaustive();
}

// The value a promise's --to or --by is refused for, as the Run line keeps it: a --by value turns
// into a placeholder, a --to value loses its separators.
function fixSeparator(found: Found<'promise-separator'>): RunWord {
  return found.flag === 'by'
    ? toPlaceholder('<when, with no ; or =>')
    : found.value.replaceAll(/[;=]/gu, ',');
}

function formatCloseKind(found: Found<'close-kind'>): string {
  return found.itemKind === 'lesson'
    ? `www: refused: ${found.id} is a lesson, and a lesson closes with drop.`
    : `www: refused: ${found.id} holds the owner's words, and they close with drop.`;
}
