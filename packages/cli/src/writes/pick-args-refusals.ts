import { match } from 'ts-pattern';
import type { ParsedArgs, RefusalReason } from '../types.ts';
import { pickCloseArgsRefusal } from './pick-close.ts';
import { pickDecisionArgsRefusal } from './pick-decision.ts';
import { pickGoalArgsRefusal } from './pick-goal-write.ts';
import { pickGrantPartsRefusal } from './pick-grant-parts-refusal.ts';
import { pickGrantTextRefusals } from './pick-grant-text-refusals.ts';
import { pickInitArgsRefusal } from './pick-init-args-refusal.ts';
import { pickItemArgsRefusal } from './pick-item-write.ts';
import { pickLessonArgsRefusal } from './pick-lesson-write.ts';
import { pickNowArgsRefusal } from './pick-now-write.ts';
import { pickPromiseArgsRefusal } from './pick-promise-write.ts';
import { pickSayArgsRefusal } from './pick-say.ts';
import { pickWordsArgsRefusal } from './pick-words-write.ts';

// The refusals a write gets from its command line before it reads the store, from the functions
// the write itself calls. A store-dependent check, such as an open id or a cap, is not here.
export function pickArgsRefusals(args: ParsedArgs, cwd: string): RefusalReason[] {
  const reason = match(args.command)
    .with('grant', 'import', () => null)
    .with('task', 'wait', 'rule', 'where', 'ok', 'set', () =>
      pickItemArgsRefusal(args, cwd, undefined),
    )
    .with('lesson', () => pickLessonArgsRefusal(args))
    .with('promise', () => pickPromiseArgsRefusal(args))
    .with('words', () => pickWordsArgsRefusal(args))
    .with('now', () => pickNowArgsRefusal(args))
    .with('goal', () => pickGoalArgsRefusal(args))
    .with('done', 'drop', 'use', () => pickCloseArgsRefusal(args))
    .with('decide', () => pickDecisionArgsRefusal(args))
    .with('say', () => pickSayArgsRefusal(args))
    .with('init', () => pickInitArgsRefusal(args))
    .otherwise(() => null);

  if (args.command === 'grant' || args.command === 'import') {
    return pickGrantArgsRefusals(args);
  }

  return reason === null ? [] : [reason];
}

// grant and import list every problem at once, so they give all their refusals.
function pickGrantArgsRefusals(args: ParsedArgs): RefusalReason[] {
  const parts = pickGrantPartsRefusal(args, args.command === 'grant');

  return [...(parts === null ? [] : [parts]), ...pickGrantTextRefusals(args)];
}
