import type { Reply } from '../types.ts';
import type { Step } from './types.ts';

export function buildReply(steps: readonly Step[]): Reply {
  const json = steps.map((step) => ({ path: step.path, ok: step.ok, detail: step.detail }));

  return {
    json,
    human: steps
      .map((step) => `${step.ok ? 'ok ' : 'fix'}  ${step.path}: ${step.detail}`)
      .join('\n'),
  };
}
