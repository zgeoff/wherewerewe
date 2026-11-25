import type { JSONNode } from './parse-json-spans.ts';

// The value of an object's key, or `undefined`. A key that appears twice is the later one, as
// `JSON.parse` reads it, so an edit lands in the value the host reads.
export function findJSONMember(node: JSONNode, key: string): JSONNode | undefined {
  return node.kind === 'object'
    ? node.members.findLast((member) => member.key === key)?.value
    : undefined;
}
