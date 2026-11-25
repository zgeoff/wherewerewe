import { parseJSONSpans } from '../install/parse-json-spans.ts';
import type { JSONNode } from '../install/parse-json-spans.ts';

// The node at a path of member names and element indexes, for a test that picks the container to
// edit. Throws for a path the text lacks, so a test never edits the wrong node.
export function getJSONNodeAt(text: string, path: readonly (string | number)[]): JSONNode {
  return path.reduce<JSONNode>((node, step) => {
    const child = pickChild(node, step);

    if (child === undefined) {
      throw new Error(`no node at ${String(step)} of ${JSON.stringify(path)}`);
    }

    return child;
  }, parseJSONSpans(text));
}

function pickChild(node: JSONNode, step: string | number): JSONNode | undefined {
  if (node.kind === 'object' && typeof step === 'string') {
    return node.members.find((member) => member.key === step)?.value;
  }

  if (node.kind === 'array' && typeof step === 'number') {
    return node.elements[step];
  }

  return undefined;
}
