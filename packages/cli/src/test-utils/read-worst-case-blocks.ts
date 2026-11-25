import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// The `| Block | Bytes |` table of brief.md's worst case: each row's label and bytes, and the
// total's bytes.
export function readWorstCaseBlocks(): {
  readonly blocks: readonly { readonly label: string; readonly bytes: number }[];
  readonly totalBytes: number;
} {
  const text = readFileSync(
    join(import.meta.dir, '..', '..', '..', '..', 'docs', 'design', 'wherewerewe', 'brief.md'),
    'utf8',
  );

  const start = text.indexOf('| Block | Bytes |');
  const table = text.slice(start, text.indexOf('\n\n', start));

  const rows = table.split('\n').flatMap((line) => {
    const cells = line.split('|').map((cell) => cell.trim());
    const bytes = /^(?<digits>[\d,]+)$/u.exec(cells[2] ?? '')?.groups?.['digits'];

    return bytes === undefined
      ? []
      : [{ label: cells[1] ?? '', bytes: Number(bytes.replaceAll(',', '')) }];
  });

  const total = /\*\*(?<digits>[\d,]+) bytes/u.exec(table)?.groups?.['digits'];

  return { blocks: rows, totalBytes: Number((total ?? '0').replaceAll(',', '')) };
}
