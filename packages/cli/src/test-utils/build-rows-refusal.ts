import type { ImportPick } from '../import/pick-import.ts';

// The refusal an import of `old-notes` returns for rows that break the rules, one line each.
export function buildRowsRefusal(problems: readonly string[]): ImportPick {
  return {
    kind: 'refused',
    refusal: {
      exitCode: 3,
      lines: [
        `www: refused: import found ${String(problems.length)} rows that break the rules, and wrote nothing.`,
        ...problems,
      ],
      runs: [{ www: ['import', 'old-notes'] }],
    },
  };
}
