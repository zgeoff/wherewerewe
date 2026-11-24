// The lines of a brief, as a write reply counts them.
export function countBriefLines(brief: string): number {
  return brief.split('\n').length - 1;
}
