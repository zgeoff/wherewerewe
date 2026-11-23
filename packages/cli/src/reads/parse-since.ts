const hourMs = 3_600_000;
const dayMs = 86_400_000;

export function parseSince(text: string, nowMs: number, started: string): number | null {
  const age = /^(?<count>\d+)(?<unit>[hd])$/u.exec(text)?.groups;

  if (age?.['count'] !== undefined && age['unit'] !== undefined) {
    return nowMs - Number(age['count']) * (age['unit'] === 'h' ? hourMs : dayMs);
  }

  const day = /^day-(?<number>\d+)$/u.exec(text)?.groups?.['number'];

  if (day === undefined) {
    return null;
  }

  const startedDate = new Date(Date.parse(started));

  const startDayMs = Date.UTC(
    startedDate.getUTCFullYear(),
    startedDate.getUTCMonth(),
    startedDate.getUTCDate(),
  );

  return startDayMs + (Number(day) - 1) * dayMs;
}
