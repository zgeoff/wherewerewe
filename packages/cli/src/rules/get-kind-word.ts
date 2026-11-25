import { match } from 'ts-pattern';
import type { FileKind, Kind } from '../types.ts';

export function getKindWord(kind: Kind | FileKind): string {
  return match(kind)
    .with('task', () => 'task')
    .with('wait', () => 'wait')
    .with('ok', () => 'approval')
    .with('rule', () => 'rule')
    .with('where', () => 'where item')
    .with('lesson', () => 'lesson')
    .with('promise', () => 'promise')
    .with('words', () => "piece of the owner's words")
    .exhaustive();
}
