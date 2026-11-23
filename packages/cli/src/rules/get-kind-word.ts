import { match } from 'ts-pattern';
import type { Kind } from '../types.ts';

export function getKindWord(kind: Kind): string {
  return match(kind)
    .with('task', () => 'task')
    .with('wait', () => 'wait')
    .with('ok', () => 'approval')
    .with('rule', () => 'rule')
    .with('where', () => 'where item')
    .exhaustive();
}
