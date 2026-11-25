import type { JSONLayout } from './get-json-layout.ts';

// The text of one value, as `"key": value` when a key is given. A multiline container takes the
// value spread over lines at the layout's indent, and a single-line one takes it on one line.
export function formatJSONItem(value: unknown, layout: JSONLayout, key: string | null): string {
  const json = layout.isMultiline
    ? JSON.stringify(value, null, layout.unit).replaceAll('\n', `\n${layout.itemIndent}`)
    : JSON.stringify(value);

  return key === null ? json : `${JSON.stringify(key)}: ${json}`;
}
