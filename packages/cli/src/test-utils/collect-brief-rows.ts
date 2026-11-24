// The lines of the brief that match the pattern.
export function collectBriefRows(brief: string, pattern: RegExp): string[] {
  return brief.split('\n').filter((line) => pattern.test(line));
}
