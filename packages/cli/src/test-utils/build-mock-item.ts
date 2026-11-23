import type { Item } from '../types.ts';

// An unchecked task written on 2026-03-10, with the fields the test names laid over it.
export function buildMockItem(fields: Partial<Item> & { readonly id: string }): Item {
  return {
    kind: 'task',
    claim: 'Write the parser',
    check: null,
    atWrite: null,
    last: null,
    written: '2026-03-10T10:31:09Z',
    by: 'agent',
    extra: {},
    ...fields,
  };
}
