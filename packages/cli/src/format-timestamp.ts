// An ISO 8601 UTC timestamp to the second, with Z, as every timestamp in the store is.
export function formatTimestamp(timeMs: number): string {
  return new Date(timeMs).toISOString().replace(/\.\d{3}Z$/u, 'Z');
}
