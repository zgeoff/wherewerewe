// Whether text is `<n>h`, `<n>d` or `day-<n>`, the forms parseSince reads.
export function isSinceText(text: string): boolean {
  return /^(?:\d+[hd]|day-\d+)$/u.test(text);
}

// The last moment of year 9999, after which an ISO time gains an expanded year.
const latestMs = 253_402_300_799_999;

// The time that text names, or null when text is not one of those forms or names a time that has
// no four-digit year or no date at all, such as `day-100000002`.
export function parseSince(text: string, nowMs: number, started: string): number | null {
  const sinceMs = pickSinceMs(text, nowMs, started);

  return sinceMs !== null && sinceMs <= latestMs && !Number.isNaN(new Date(sinceMs).getTime())
    ? sinceMs
    : null;
}

const hourMs = 3_600_000;
const dayMs = 86_400_000;

function pickSinceMs(text: string, nowMs: number, started: string): number | null {
  if (!isSinceText(text)) {
    return null;
  }

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
