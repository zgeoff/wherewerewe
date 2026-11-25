import { listKinds } from '../rules/list-kinds.ts';

type JsonCellShape = 'brief' | 'show' | 'log' | 'list' | 'recap';

export interface JsonCellArgv {
  readonly shape: JsonCellShape;

  // the read's words before --json
  readonly argv: readonly string[];
}

// Every --json read of the store seed-json-cells-store.ts writes: the brief, show with no id and
// with each id it holds, grant included, the log, a list of each kind, and the recap.
export function buildJsonCellArgvs(): JsonCellArgv[] {
  return [
    { shape: 'brief', argv: [] },
    { shape: 'show', argv: ['show'] },
    ...['t-a', 'w-a', 'ok-a', 'r-a', 'wh-a', 'l-a', 'p-a', 'w-b', 'd-1', 'grant'].map(
      (id): JsonCellArgv => ({ shape: 'show', argv: ['show', id] }),
    ),
    { shape: 'log', argv: ['log'] },
    ...listKinds.map((kind): JsonCellArgv => ({ shape: 'list', argv: ['list', kind] })),
    { shape: 'recap', argv: ['recap'] },
  ];
}
