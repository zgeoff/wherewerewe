import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { match } from 'ts-pattern';
import { parseItemsFile } from '../store/parse-items-file.ts';

// The ids in a session folder's items.tsv, sorted. A file that does not parse reads as no ids.
export function readItemIDs(folder: string): string[] {
  const text = readFileSync(join(folder, 'items.tsv'), 'utf8');

  return match(parseItemsFile(text, '2'))
    .with({ kind: 'items' }, (found) => found.items.map((item) => item.id).toSorted())
    .with({ kind: 'broken' }, () => [])
    .exhaustive();
}
