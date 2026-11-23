const dayMs = 86_400_000;

// The count of UTC calendar days from the date of `started` to today, plus 1.
export function getSessionDay(started: string, nowMs: number): number {
  const startedDate = new Date(Date.parse(started));

  const startDayMs = Date.UTC(
    startedDate.getUTCFullYear(),
    startedDate.getUTCMonth(),
    startedDate.getUTCDate(),
  );

  const nowDate = new Date(nowMs);

  const nowDayMs = Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth(), nowDate.getUTCDate());

  return Math.round((nowDayMs - startDayMs) / dayMs) + 1;
}
