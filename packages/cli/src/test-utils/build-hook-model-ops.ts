import fc from 'fast-check';
import type { HookModelCall, HookModelOp, HookModelPayload } from './run-hook-model.ts';

const payloads: readonly HookModelPayload[] = [
  'start',
  'pre-brief',
  'pre-brief-session',
  'pre-www-list',
  'pre-www-pipe',
  'pre-ls',
  'pre-mcp',
  'end-whole',
  'end-cut',
  'end-failed',
  'stop',
  'stop-active',
];

// The operations a generated sequence is made of: each payload of the gate from the main agent, a
// subagent or an unbound id, an attach to another store, and two payloads at once. The main agent
// is weighted over the rest so a sequence reaches every state. A SessionStart carries no `agent_id`.
export function buildHookModelOps(): fc.Arbitrary<HookModelOp> {
  const call: fc.Arbitrary<HookModelCall> = fc
    .record({
      payload: fc.constantFrom(...payloads),
      from: fc.constantFrom('main', 'main', 'main', 'main', 'subagent', 'unbound'),
    })
    .filter((found) => !(found.payload === 'start' && found.from === 'subagent'));

  return fc.oneof(
    { weight: 12, arbitrary: call.map((found): HookModelOp => ({ kind: 'call', ...found })) },
    { weight: 1, arbitrary: fc.constant<HookModelOp>({ kind: 'attach' }) },
    {
      weight: 2,
      arbitrary: fc
        .tuple(call, call)
        .map(([first, second]): HookModelOp => ({ kind: 'together', first, second })),
    },
  );
}
