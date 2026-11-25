import { isRecord } from '../hooks/is-record.ts';
import { addJSONItem } from './add-json-item.ts';
import { parseJSONSettings } from './parse-json-settings.ts';
import { parseJSONSpans } from './parse-json-spans.ts';
import type { JSONNode } from './parse-json-spans.ts';

export type AllowMerge =
  | { readonly kind: 'unreadable' }
  | { readonly kind: 'merged'; readonly text: string; readonly isAdded: boolean };

// The settings text with the rule once in `permissions.allow`: every other byte stays, and the
// rule is not added twice. A missing or blank file gives a new one. `null` text means no file.
export function mergeAllowRule(text: string | null, rule: string): AllowMerge {
  const read = parseJSONSettings(text ?? '');

  if (read.kind === 'unreadable' || !isAllowShape(read)) {
    return { kind: 'unreadable' };
  }

  if (read.kind === 'blank' || text === null) {
    return {
      kind: 'merged',
      text: `${JSON.stringify({ permissions: { allow: [rule] } }, null, 2)}\n`,
      isAdded: true,
    };
  }

  return addRule(text, rule);
}

function isAllowShape(read: ReturnType<typeof parseJSONSettings>): boolean {
  if (read.kind !== 'object') {
    return true;
  }

  const permissions = read.value['permissions'];

  if (permissions === undefined) {
    return true;
  }

  return (
    isRecord(permissions) &&
    (permissions['allow'] === undefined || Array.isArray(permissions['allow']))
  );
}

function addRule(text: string, rule: string): AllowMerge {
  const root = parseJSONSpans(text);
  const permissions = findMember(root, 'permissions');

  if (permissions === undefined) {
    return {
      kind: 'merged',
      text: addJSONItem(text, root, 'permissions', { allow: [rule] }),
      isAdded: true,
    };
  }

  const allow = findMember(permissions, 'allow');

  if (allow === undefined) {
    return { kind: 'merged', text: addJSONItem(text, permissions, 'allow', [rule]), isAdded: true };
  }

  const rules: unknown = JSON.parse(text.slice(allow.start, allow.end));

  if (Array.isArray(rules) && rules.includes(rule)) {
    return { kind: 'merged', text, isAdded: false };
  }

  return { kind: 'merged', text: addJSONItem(text, allow, null, rule), isAdded: true };
}

function findMember(node: JSONNode, key: string): JSONNode | undefined {
  return node.kind === 'object'
    ? node.members.find((member) => member.key === key)?.value
    : undefined;
}
