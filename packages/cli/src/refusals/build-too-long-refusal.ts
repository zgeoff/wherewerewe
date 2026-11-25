import { match } from 'ts-pattern';
import type { Refusal, RefusalReason, TextTarget } from '../types.ts';
import { refuse } from './refuse.ts';
import { replaceText } from './replace-text.ts';
import { toPlaceholder } from './to-placeholder.ts';

type Found<Variant extends RefusalReason['kind']> = Extract<RefusalReason, { kind: Variant }>;

// The texts that state a fact in a row: past its limit, the rest belongs in more rows or a file.
const rowFactLabels: ReadonlySet<TextTarget['label']> = new Set<TextTarget['label']>([
  'claim',
  'next step',
  'note',
  'decision',
  'reason',
  'evidence',
  'why',
  'lesson',
  'promise',
  '--for text',
]);

// The line a length refusal of such a text adds after its reason.
const splitRowLine =
  'One row holds one fact: split the rest into rows, or put the detail in a file as a list or a table and record the file with www where.';

export function buildTooLongRefusal(found: Found<'text-too-long'>): Refusal {
  const refusal = buildTooLongReason(found);

  return rowFactLabels.has(found.target.label)
    ? { ...refusal, lines: [...refusal.lines, splitRowLine] }
    : refusal;
}

function buildTooLongReason(found: Found<'text-too-long'>): Refusal {
  if (found.target.label === 'note') {
    return refuse(
      `www: refused: the note is ${String(found.length)} characters, and the limit is ${String(found.limit)}. Keep what you need on your next turn to this item, and link the rest from a PR, an issue or a file.`,
      replaceText(found.args, found.target, toPlaceholder('<note of at most 400 characters>')),
    );
  }

  const placeholder = toPlaceholder(
    `<${found.target.label} of at most ${String(found.limit)} characters>`,
  );

  const measured = `the ${found.target.label} is ${String(found.length)} characters, and the limit is ${String(found.limit)}.`;

  const advice = match(found.target.label)
    .with(
      'claim',
      'next step',
      'quote',
      () => 'Write what is true now, and put the detail in its note with --note.',
    )
    .with('reading', "grant's scope", () => null)
    .otherwise(() => 'Write what is true now; the story belongs in a PR or a commit.');

  return refuse(
    `www: refused: ${advice === null ? measured : `${measured} ${advice}`}`,
    replaceText(found.args, found.target, placeholder),
  );
}
