import { formatJSONItem } from './format-json-item.ts';
import { getJSONLayout } from './get-json-layout.ts';
import { listJSONItems } from './list-json-items.ts';
import type { JSONNode } from './parse-json-spans.ts';

// Adds a member (with a key) to an object, or an element (with no key) to an array, after the last
// item, leaving every other character of the text as it is.
export function addJSONItem(
  text: string,
  container: JSONNode,
  key: string | null,
  value: unknown,
): string {
  const items = listJSONItems(container);
  const last = items.at(-1);
  const layout = getJSONLayout(text, container, items[0]?.start ?? null);
  const item = formatJSONItem(value, layout, key);

  if (last === undefined) {
    const inside = layout.isMultiline
      ? `\n${layout.itemIndent}${item}\n${layout.closeIndent}`
      : item;

    return `${text.slice(0, container.start + 1)}${inside}${text.slice(container.end - 1)}`;
  }

  const gap = layout.isMultiline ? `\n${layout.itemIndent}` : ' ';

  return `${text.slice(0, last.end)},${gap}${item}${text.slice(last.end)}`;
}
