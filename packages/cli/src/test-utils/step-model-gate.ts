import { match } from 'ts-pattern';
import type { GateState } from '../hooks/types.ts';

// An independent model of the gate's state table, written from sessions-and-hooks.md as plain
// transitions, so no code of the hook shares a line with it. The walk compares every transition
// of the hook's own step function with it.
export interface ModelGate {
  readonly state: GateState;
  readonly reads: number;
  readonly spare: 0 | 1;
  readonly stopActive: boolean;
}

export type ModelEvent =
  | 'SS'
  | 'PreBrief'
  | 'PreWww'
  | 'PreOther'
  | 'PostWhole'
  | 'PostCut'
  | 'PostFailed'
  | 'Lost'
  | 'Stop'
  | 'SubPre'
  | 'SubPost'
  | 'SubStop';

export type ModelOutput =
  | 'pass'
  | 'refuse-standard'
  | 'refuse-cut'
  | 'pass+line'
  | 'block'
  | 'inject'
  | 'none';

type ModelStep = readonly [ModelGate, ModelOutput];

export function stepModelGate(gate: ModelGate, event: ModelEvent): ModelStep {
  const calm: ModelGate = { ...gate, stopActive: false };

  return match(event)
    .with('SS', (): ModelStep => [
      { ...gate, state: 'wiped', spare: 1, stopActive: false },
      'inject',
    ])
    .with('PreBrief', (): ModelStep => {
      const isClosed = gate.state === 'wiped' || gate.state === 'reading' || gate.state === 'cut';

      return [{ ...calm, reads: gate.reads + 1, state: isClosed ? 'reading' : gate.state }, 'pass'];
    })
    .with('PreWww', (): ModelStep => [calm, 'pass'])
    .with('PreOther', (): ModelStep => stepOtherCall(calm))
    .with('PostWhole', (): ModelStep => [
      { ...gate, reads: Math.max(gate.reads - 1, 0), state: 'read' },
      'none',
    ])
    .with('PostCut', 'PostFailed', (ended): ModelStep => {
      const reads = Math.max(gate.reads - 1, 0);
      const settles = gate.state === 'reading' && reads === 0;
      const state = ended === 'PostCut' ? 'cut' : 'failed';

      return [{ ...gate, reads, state: settles ? state : gate.state }, 'none'];
    })
    .with('Stop', (): ModelStep => stepStop(gate))
    .with('Lost', 'SubPre', 'SubPost', 'SubStop', (): ModelStep => [gate, 'none'])
    .exhaustive();
}

function stepOtherCall(gate: ModelGate): ModelStep {
  return match(gate.state)
    .with('wiped', 'reading', (): ModelStep => [gate, 'refuse-standard'])
    .with('cut', (): ModelStep =>
      gate.spare === 1
        ? [{ ...gate, spare: 0 }, 'refuse-cut']
        : [{ ...gate, state: 'open' }, 'pass+line'],
    )
    .with('failed', (): ModelStep => [{ ...gate, state: 'open' }, 'pass+line'])
    .with('read', 'open', (): ModelStep => [gate, 'pass'])
    .exhaustive();
}

function stepStop(gate: ModelGate): ModelStep {
  const stopped: ModelGate = { ...gate, reads: 0 };

  if (gate.state === 'reading') {
    return [{ ...stopped, state: 'failed' }, 'none'];
  }

  if (gate.state === 'wiped' && !gate.stopActive) {
    return [{ ...stopped, stopActive: true }, 'block'];
  }

  return [{ ...stopped, state: gate.state === 'wiped' ? 'failed' : gate.state }, 'none'];
}
