import type { BriefInput } from '../brief/types.ts';
import { buildMockIDs } from './build-mock-ids.ts';
import { buildThreeByteCutInput } from './build-three-byte-cut-input.ts';

// The 3-byte worst case at its widest never-cut lines: a wait in focus with its next step shown,
// every section's heading with its count or cut line, DECISIONS with both, ages of 4 characters on
// day 999, and `--session` with a 24-character name.
export function buildNeverCutInput(host: BriefInput['host']): BriefInput {
  const input = buildThreeByteCutInput(host);

  return {
    ...input,
    session: { ...input.session, now: buildMockIDs('wait', 1)[0] ?? '' },
    nowHidden: null,
    sessionFlag: 'n'.repeat(24),
  };
}
