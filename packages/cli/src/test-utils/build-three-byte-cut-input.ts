import type { BriefInput } from '../brief/types.ts';
import { buildThreeByteBriefInput } from './build-three-byte-brief-input.ts';
import { buildWorstCaseBriefInput } from './build-worst-case-brief-input.ts';

export function buildThreeByteCutInput(host: BriefInput['host']): BriefInput {
  return buildThreeByteBriefInput({
    ...buildWorstCaseBriefInput({ host, taskCount: 30, goal: 'short' }),
    nowHidden: { kind: 'changed' },
  });
}
