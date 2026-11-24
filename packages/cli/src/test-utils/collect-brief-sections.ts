// The headings of the item sections a brief prints, without their counts, in order.
export function collectBriefSections(brief: string): string[] {
  return brief
    .split('\n')
    .filter((line) => /^[A-Z ]+ \(\d+(?:, max \d+)?\)/u.test(line))
    .map((line) => line.split(' (')[0] ?? '');
}
