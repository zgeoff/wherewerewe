import { match } from 'ts-pattern';
import { wrapBlock } from '../brief/wrap-block.ts';
import type { Refusal, RefusalReason, RunWord } from '../types.ts';
import { buildRunSpec } from './build-run-spec.ts';
import { toPlaceholder } from './to-placeholder.ts';

type NoteReason = Extract<
  RefusalReason,
  {
    kind:
      | 'owed-needs-note'
      | 'note-and-no-note'
      | 'set-needs-change'
      | 'set-check-needs-claim'
      | 'no-note-to-clear'
      | 'owed-note';
  }
>;

export function buildNoteRefusal(reason: NoteReason): Refusal {
  return match(reason)
    .with({ kind: 'owed-needs-note' }, (found) =>
      refuse(
        'www: refused: --owed marks a note, and this command gives none.',
        buildRunSpec(found.args)
          .dropFlag('no-note')
          .addFlagBefore('owed', 'note', toPlaceholder('<what is owed>'))
          .toArgv(),
      ),
    )
    .with({ kind: 'note-and-no-note' }, (found) =>
      refuse(
        'www: refused: --note replaces the note and --no-note clears it; give one.',
        buildRunSpec(found.args).dropFlag('no-note').toArgv(),
      ),
    )
    .with({ kind: 'set-needs-change' }, (found) =>
      refuse(
        'www: refused: set needs a claim, --note or --no-note.',
        buildRunSpec(found.args).addPositional(toPlaceholder('<claim>')).toArgv(),
      ),
    )
    .with({ kind: 'set-check-needs-claim' }, (found) =>
      refuse(
        'www: refused: a check belongs to a claim, and set with no claim changes only the note.',
        buildRunSpec(found.args).addPositional(toPlaceholder('<claim>')).toArgv(),
      ),
    )
    .with({ kind: 'no-note-to-clear' }, (found) =>
      refuse(`www: refused: ${found.id} has no note to clear.`, ['show', found.id]),
    )
    .with({ kind: 'owed-note' }, (found): Refusal => ({
      exitCode: 3,
      lines: [
        `www: refused: ${found.id} has an owed note (${found.age}). Clear it once the work is done, or replace it with a note that is not owed.`,
        ...wrapBlock(found.note, '    ', '    '),
      ],
      runs: [
        { www: ['set', found.id, '--no-note'] },
        { www: ['set', found.id, '--note', toPlaceholder('<detail>')] },
      ],
    }))
    .exhaustive();
}

function refuse(line: string, argv: readonly RunWord[]): Refusal {
  return { exitCode: 3, lines: [line], runs: [{ www: argv }] };
}
