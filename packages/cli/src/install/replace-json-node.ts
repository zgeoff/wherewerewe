import { formatJSONItem } from './format-json-item.ts';
import { getJSONLayout } from './get-json-layout.ts';
import { listJSONItems } from './list-json-items.ts';
import type { JSONNode } from './parse-json-spans.ts';

// Replaces one object with a new value, laid out as the old one was, and leaves every character
// outside its span as it is.
export function replaceJSONNode(text: string, node: JSONNode, value: unknown): string {
  const first = listJSONItems(node)[0]?.start ?? null;
  const layout = getJSONLayout(text, node, first);
  const isMultiline = text.slice(node.start, node.end).includes('\n');

  const body = formatJSONItem(
    value,
    { ...layout, isMultiline, itemIndent: layout.closeIndent },
    null,
  );

  return `${text.slice(0, node.start)}${body}${text.slice(node.end)}`;
}
