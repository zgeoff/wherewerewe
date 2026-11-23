const minuteMs = 60_000;
const hourMs = 3_600_000;
const dayMs = 86_400_000;

// An age floors: <n>m under an hour, <n>h under 48 hours, <n>d after that.
export function formatAge(ageMs: number): string {
  if (ageMs < hourMs) {
    return `${String(Math.floor(Math.max(ageMs, 0) / minuteMs))}m`;
  }

  return ageMs < 48 * hourMs
    ? `${String(Math.floor(ageMs / hourMs))}h`
    : `${String(Math.floor(ageMs / dayMs))}d`;
}
