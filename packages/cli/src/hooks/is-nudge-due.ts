import type { SessionFile } from '../types.ts';

const twentyMinutesMs = 20 * 60_000;

// The nudge is due when the last write and the last nudge are each more than 20 minutes old. A
// session that was never written to counts from when it started.
export function isNudgeDue(session: SessionFile, nowMs: number): boolean {
  const lastWriteMs = Date.parse(session.lastWrite ?? session.started);

  const lastNudgeMs =
    session.lastNudge === null ? Number.NEGATIVE_INFINITY : Date.parse(session.lastNudge);

  return nowMs - lastWriteMs > twentyMinutesMs && nowMs - lastNudgeMs > twentyMinutesMs;
}
