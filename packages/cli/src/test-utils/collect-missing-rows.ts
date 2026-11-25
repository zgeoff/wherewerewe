import type { BriefInput } from '../brief/types.ts';

// The ids of the rows of the input that the brief does not print: each item, owner's word,
// promise and lesson, and the 3 newest decisions. A changed row and a pull request row are not
// ids of these kinds, so they are not named here.
export function collectMissingRows(input: BriefInput, brief: string): string[] {
  const lines = brief.split('\n');

  const ids = [
    ...input.items.map((item) => item.id),
    ...input.words.map((row) => row.id),
    ...input.promises.map((row) => row.id),
    ...input.lessons.map((row) => row.id),
    ...input.decisions.slice(0, 3).map((row) => row.id),
  ];

  return ids.filter((id) => !lines.some((line) => line.startsWith(`  ${id}`)));
}
