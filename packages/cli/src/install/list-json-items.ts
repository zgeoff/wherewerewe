import type { JSONNode } from './parse-json-spans.ts';

export interface JSONItem {
  // the first character of the item: a member's key, or an element's value
  readonly start: number;
  readonly end: number;
}

// The members of an object or the elements of an array, as spans, in text order.
export function listJSONItems(container: JSONNode): readonly JSONItem[] {
  if (container.kind === 'object') {
    return container.members.map((member) => ({ start: member.keyStart, end: member.value.end }));
  }

  return container.kind === 'array' ? container.elements : [];
}
