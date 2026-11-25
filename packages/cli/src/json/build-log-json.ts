import type { JournalRow } from '../types.ts';
import { jsonVersion } from './json-version.ts';
import type { LogJson } from './types.ts';

// The rows the text form prints, oldest first.
export function buildLogJSON(rows: readonly JournalRow[]): LogJson {
  return {
    ...jsonVersion,
    rows: rows.toSorted((left, right) => Date.parse(left.ts) - Date.parse(right.ts)),
  };
}
