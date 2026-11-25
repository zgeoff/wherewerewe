import type { JSONNode } from './parse-json-spans.ts';

// Removes one element of an array with the comma beside it, and leaves every other character as
// it is. The last element left empties the array to `[]`.
export function removeJSONElement(text: string, array: JSONNode, index: number): string {
  const elements = array.kind === 'array' ? array.elements : [];
  const target = elements[index];

  if (target === undefined) {
    return text;
  }

  const before = elements[index - 1];
  const after = elements[index + 1];

  if (before !== undefined) {
    return `${text.slice(0, before.end)}${text.slice(target.end)}`;
  }

  if (after !== undefined) {
    return `${text.slice(0, target.start)}${text.slice(after.start)}`;
  }

  return `${text.slice(0, array.start + 1)}${text.slice(array.end - 1)}`;
}
