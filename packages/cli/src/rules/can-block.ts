import { match } from 'ts-pattern';
import type { Kind } from '../types.ts';

// A task names an open task or wait as what blocks it.
export function canBlock(kind: Kind): boolean {
  return match(kind)
    .with('task', 'wait', () => true)
    .with('ok', 'rule', 'where', () => false)
    .exhaustive();
}
