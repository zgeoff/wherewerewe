import type { Harness } from '../hooks/types.ts';
import { addJSONItem } from './add-json-item.ts';
import type { HookEntry } from './build-hook-entries.ts';
import { buildHookGroup } from './build-hook-group.ts';
import { isOurHandler } from './is-our-handler.ts';
import { parseJSONSpans } from './parse-json-spans.ts';
import type { JSONNode } from './parse-json-spans.ts';
import { removeJSONElement } from './remove-json-element.ts';
import { replaceJSONNode } from './replace-json-node.ts';

export interface EventEdit {
  readonly text: string;
  readonly kind: 'added' | 'replaced' | 'removed' | 'same';
}

// One edit that moves the event's list toward holding exactly one wherewerewe entry, the entry's:
// add it when the list has none, remove the last of several, and replace the one it has when it
// differs. `same` when nothing is left to do.
export function planEventEdit(text: string, harness: Harness, entry: HookEntry): EventEdit {
  const group = buildHookGroup(entry);
  const root = parseJSONSpans(text);
  const hooks = findMember(root, 'hooks');

  if (hooks === undefined) {
    return { text: addJSONItem(text, root, 'hooks', { [entry.event]: [group] }), kind: 'added' };
  }

  const list = findMember(hooks, entry.event);

  if (list === undefined) {
    return { text: addJSONItem(text, hooks, entry.event, [group]), kind: 'added' };
  }

  const spots = listSpots(text, list, harness);
  const last = spots.at(-1);

  if (last === undefined) {
    return { text: addJSONItem(text, list, null, group), kind: 'added' };
  }

  if (spots.length > 1) {
    return { text: removeSpot(text, list, last), kind: 'removed' };
  }

  return replaceSpot(text, { list, spot: last, group, handler: group.hooks[0] });
}

function findMember(node: JSONNode, key: string): JSONNode | undefined {
  return node.kind === 'object'
    ? node.members.find((member) => member.key === key)?.value
    : undefined;
}

interface Spot {
  readonly groupIndex: number;
  readonly handlerIndex: number;
  readonly handlerCount: number;
}

function listSpots(text: string, list: JSONNode, harness: Harness): readonly Spot[] {
  const groups = list.kind === 'array' ? list.elements : [];

  return groups.flatMap((groupNode, groupIndex) => {
    const handlers = findMember(groupNode, 'hooks');
    const handlerNodes = handlers?.kind === 'array' ? handlers.elements : [];

    return handlerNodes.flatMap((handlerNode, handlerIndex) =>
      isOurHandler(JSON.parse(text.slice(handlerNode.start, handlerNode.end)), harness)
        ? [{ groupIndex, handlerIndex, handlerCount: handlerNodes.length }]
        : [],
    );
  });
}

function removeSpot(text: string, list: JSONNode, spot: Spot): string {
  if (spot.handlerCount === 1) {
    return removeJSONElement(text, list, spot.groupIndex);
  }

  const groups = list.kind === 'array' ? list.elements : [];
  const groupNode = groups[spot.groupIndex];
  const handlers = groupNode === undefined ? undefined : findMember(groupNode, 'hooks');

  return handlers === undefined ? text : removeJSONElement(text, handlers, spot.handlerIndex);
}

interface SpotReplacement {
  readonly list: JSONNode;
  readonly spot: Spot;
  readonly group: unknown;
  readonly handler: unknown;
}

function replaceSpot(text: string, replacement: SpotReplacement): EventEdit {
  const groups = replacement.list.kind === 'array' ? replacement.list.elements : [];
  const groupNode = groups[replacement.spot.groupIndex];
  const handlers = groupNode === undefined ? undefined : findMember(groupNode, 'hooks');

  const handlerNode =
    handlers?.kind === 'array' ? handlers.elements[replacement.spot.handlerIndex] : undefined;

  const isWhole = replacement.spot.handlerCount === 1;
  const target = isWhole ? groupNode : handlerNode;
  const value = isWhole ? replacement.group : replacement.handler;

  if (target === undefined) {
    return { text, kind: 'same' };
  }

  const current: unknown = JSON.parse(text.slice(target.start, target.end));

  return Bun.deepEquals(current, value)
    ? { text, kind: 'same' }
    : { text: replaceJSONNode(text, target, value), kind: 'replaced' };
}
