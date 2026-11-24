const utcFormat = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u;

// True for an ISO 8601 UTC time to the second, ending in Z, that names a real moment. Date.parse
// rolls an impossible date, such as 02-30, into the next month, so compare the round trip.
export function isUTCTime(text: string): boolean {
  const parsedAtMs = Date.parse(text);

  return (
    utcFormat.test(text) &&
    !Number.isNaN(parsedAtMs) &&
    new Date(parsedAtMs).toISOString() === text.replace('Z', '.000Z')
  );
}
