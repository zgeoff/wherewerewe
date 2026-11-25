// True when a line of the brief starts with two spaces and the mark, such as a row's id.
export function hasBriefRow(brief: string, mark: string): boolean {
  return brief.split('\n').some((line) => line.startsWith(`  ${mark}`));
}
