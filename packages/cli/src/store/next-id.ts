import type { Row } from '../types.ts';

// The next free id for a label, such as wait-3.
export function nextID(lines: readonly Row[], label: string): string {
  const taken = new Set(lines.map((row) => row.id));

  let count = lines.filter((row) => row.label === label).length + 1;

  while (taken.has(`${label}-${count}`)) {
    count += 1;
  }

  return `${label}-${count}`;
}
