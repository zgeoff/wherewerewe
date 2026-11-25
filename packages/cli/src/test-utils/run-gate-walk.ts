import { match } from 'ts-pattern';
import { stepGate } from '../hooks/step-gate.ts';
import type { GateEvent, GateFile, GateOutput } from '../hooks/types.ts';
import { stepModelGate } from './step-model-gate.ts';
import type { ModelEvent, ModelOutput } from './step-model-gate.ts';

export interface GateWalkOptions {
  readonly depth: number;

  // no SessionStart comes while a read runs
  readonly isAssumingNoStartInFlight: boolean;

  // Stop(active=true) may follow any event, not only a Stop that blocked
  readonly isStopActiveFree: boolean;
}

export interface GateWalkResult {
  readonly failures: readonly string[];
  readonly checked: number;
}

interface WalkContext {
  readonly options: GateWalkOptions;
  readonly failures: string[];
  readonly seen: Set<string>;
  checked: number;
}

const bound = 'tide-alerts';

// Walks every sequence of events up to the depth, steps the hook's gate function and the
// independent model on each transition, and checks the invariants of the design. A node that
// the walk reached before with the same gate file, world, refusals and depth is not walked again.
export function runGateWalk(options: GateWalkOptions): GateWalkResult {
  const context: WalkContext = { options, failures: [], seen: new Set(), checked: 0 };

  explore(context, {
    file: { state: 'wiped', session: bound, reads: 0, spare: 1 },
    world: { inflight: 0, old: 0 },
    trace: ['SS->wiped'],
    depth: options.depth,
    refused: null,
  });

  return { failures: context.failures, checked: context.checked };
}

interface World {
  // reads the gate let through since the last SessionStart that still run
  readonly inflight: number;

  // reads that started before the last SessionStart and still run
  readonly old: number;
}

interface Node {
  readonly file: GateFile;
  readonly world: World;
  readonly trace: readonly string[];
  readonly depth: number;

  // refusals since a cut or failed read ended, null before one
  readonly refused: number | null;
}

// The walk's events: the model's events, with Stop split by the flag the host sends.
type WalkEvent = Exclude<ModelEvent, 'Stop'> | 'StopInactive' | 'StopActive';

const allEvents: readonly WalkEvent[] = [
  'SS',
  'PreBrief',
  'PreWww',
  'PreOther',
  'PostWhole',
  'PostCut',
  'PostFailed',
  'Lost',
  'StopInactive',
  'StopActive',
  'SubPre',
  'SubPost',
  'SubStop',
];

function explore(context: WalkContext, node: Node): void {
  const key = JSON.stringify([node.file, node.world, node.refused, node.depth]);

  if (context.seen.has(key)) {
    return;
  }

  context.seen.add(key);

  context.checked += 1;

  if (node.depth === 0) {
    return;
  }

  for (const event of allEvents.filter((candidate) => isAllowed(context, node.world, candidate))) {
    for (const owner of listOwners(node.world, event)) {
      stepNode(context, node, event, owner);
    }
  }
}

function isAllowed(context: WalkContext, world: World, event: WalkEvent): boolean {
  const running = world.inflight + world.old;

  return match(event)
    .with('PostWhole', 'PostCut', 'PostFailed', 'Lost', () => running > 0)
    .with('StopInactive', 'SubStop', () => running === 0)
    .with('StopActive', () => running === 0 && context.options.isStopActiveFree)
    .with('SS', () => !context.options.isAssumingNoStartInFlight || running === 0)
    .with('PreBrief', 'PreWww', 'PreOther', 'SubPre', 'SubPost', () => true)
    .exhaustive();
}

// An end event may belong to a read that started before the last SessionStart.
function listOwners(world: World, event: WalkEvent): readonly ('new' | 'old')[] {
  const isEnd = event === 'PostWhole' || event === 'PostCut' || event === 'PostFailed';

  if (!isEnd && event !== 'Lost') {
    return ['new'];
  }

  return [
    ...(world.inflight > 0 ? (['new'] as const) : []),
    ...(world.old > 0 ? (['old'] as const) : []),
  ];
}

function stepNode(context: WalkContext, node: Node, event: WalkEvent, owner: 'new' | 'old'): void {
  const mapped = toGateEvent(event);

  const hook =
    mapped.gate === null
      ? { file: null, output: { kind: 'none' } as const }
      : stepGate(node.file, bound, mapped.gate, mapped.agentID);

  const next = hook.file ?? node.file;
  const world = advanceWorld(node.world, event, owner);
  const marker = owner === 'old' ? '(old)' : '';
  const label = `${event}${marker}->${next.state}${String(next.reads)}/${String(next.spare)}:${hook.output.kind}`;
  const where = [...node.trace, label].join(' ');

  const [model, modelOutput] = stepModelGate(
    {
      state: node.file.state,
      reads: node.file.reads,
      spare: node.file.spare,
      stopActive: event === 'StopActive',
    },
    toModelEvent(event),
  );

  const isModelSame =
    model.state === next.state &&
    model.reads === next.reads &&
    model.spare === next.spare &&
    isSameOutput(toModelOutput(hook.output), modelOutput, event);

  const problems = [
    ...checkInvariants(node, {
      event,
      next,
      output: hook.output,
      world,
      isWritten: hook.file !== null,
    }),
    ...(isModelSame ? [] : ['ORACLE']),
  ];

  context.failures.push(...problems.map((problem) => `${problem} ${where}`));

  explore(context, {
    file: next,
    world,
    trace: [...node.trace, label],
    depth: node.depth - 1,
    refused: countRefusals(node, { event, next, output: hook.output }),
  });
}

const subagent = 'sub-1';

function toGateEvent(event: WalkEvent): { gate: GateEvent | null; agentID: string | null } {
  return match(event)
    .with('SS', () => ({ gate: { kind: 'session-start' } as const, agentID: null }))
    .with('PreBrief', () => ({
      gate: { kind: 'call', call: 'brief-command' } as const,
      agentID: null,
    }))
    .with('PreWww', () => ({ gate: { kind: 'call', call: 'www-command' } as const, agentID: null }))
    .with('PreOther', () => ({
      gate: { kind: 'call', call: 'other-call' } as const,
      agentID: null,
    }))
    .with('PostWhole', () => ({ gate: { kind: 'end', end: 'whole' } as const, agentID: null }))
    .with('PostCut', () => ({ gate: { kind: 'end', end: 'cut' } as const, agentID: null }))
    .with('PostFailed', () => ({ gate: { kind: 'end', end: 'failed' } as const, agentID: null }))
    .with('StopInactive', () => ({
      gate: { kind: 'stop', stopHookActive: false } as const,
      agentID: null,
    }))
    .with('StopActive', () => ({
      gate: { kind: 'stop', stopHookActive: true } as const,
      agentID: null,
    }))
    .with('SubPre', () => ({
      gate: { kind: 'call', call: 'other-call' } as const,
      agentID: subagent,
    }))
    .with('SubPost', () => ({ gate: { kind: 'end', end: 'whole' } as const, agentID: subagent }))
    .with('SubStop', () => ({
      gate: { kind: 'stop', stopHookActive: false } as const,
      agentID: subagent,
    }))
    .with('Lost', () => ({ gate: null, agentID: null }))
    .exhaustive();
}

function advanceWorld(world: World, event: WalkEvent, owner: 'new' | 'old'): World {
  return match(event)
    .with('SS', (): World => ({ inflight: 0, old: world.old + world.inflight }))
    .with('PreBrief', (): World => ({ ...world, inflight: world.inflight + 1 }))
    .with('PostWhole', 'PostCut', 'PostFailed', 'Lost', (): World =>
      owner === 'new'
        ? { ...world, inflight: world.inflight - 1 }
        : { ...world, old: world.old - 1 },
    )
    .otherwise((): World => world);
}

function toModelEvent(event: WalkEvent): ModelEvent {
  return event === 'StopInactive' || event === 'StopActive' ? 'Stop' : event;
}

// The model has one `none` for a silent event and for a Stop or an end that passes, where the
// hook says `pass` for the call that a subagent's payload or a `www` command makes.
function isSameOutput(hook: ModelOutput, model: ModelOutput, event: WalkEvent): boolean {
  const isCall = event === 'PreWww' || event === 'PreBrief';

  return hook === model || (hook === 'pass' && model === 'none' && !isCall);
}

function toModelOutput(output: GateOutput): ModelOutput {
  return match(output)
    .with({ kind: 'refuse', reason: 'cut' }, (): ModelOutput => 'refuse-cut')
    .with({ kind: 'refuse' }, (): ModelOutput => 'refuse-standard')
    .with({ kind: 'pass-with-line' }, (): ModelOutput => 'pass+line')
    .with({ kind: 'pass' }, (): ModelOutput => 'pass')
    .with({ kind: 'block' }, (): ModelOutput => 'block')
    .with({ kind: 'inject' }, (): ModelOutput => 'inject')
    .with({ kind: 'none' }, (): ModelOutput => 'none')
    .exhaustive();
}

interface Transition {
  readonly event: WalkEvent;
  readonly next: GateFile;
  readonly output: GateOutput;
}

interface Checked extends Transition {
  readonly world: World;
  readonly isWritten: boolean;
}

function checkInvariants(node: Node, checked: Checked): string[] {
  const event = checked.event;
  const next = checked.next;
  const output = checked.output;
  const world = checked.world;
  const running = node.world.inflight + node.world.old;

  const isClosed =
    node.file.state === 'wiped' || node.file.state === 'reading' || node.file.state === 'cut';

  const refused = countRefusals(node, checked);

  return [
    ...(event === 'PreOther' && output.kind !== 'refuse' && isClosed && running > 0 ? ['I1'] : []),
    ...(event.startsWith('Sub') && checked.isWritten ? ['I4'] : []),
    ...(refused !== null && refused > 1 ? ['I2'] : []),
    ...(node.file.state === 'wiped' && event === 'StopActive' ? checkFailOpenOnce(next) : []),
    ...(world.inflight + world.old === 0 ? checkOpens(next) : []),
  ];
}

function countRefusals(node: Node, transition: Transition): number | null {
  const event = transition.event;
  const next = transition.next;
  const output = transition.output;
  const settles = next.state === 'cut' || next.state === 'failed';
  const isStop = event === 'StopInactive' || event === 'StopActive';

  const isEnded =
    event === 'PostCut' || event === 'PostFailed' || (isStop && node.file.state === 'reading');

  if (event === 'SS' || next.state === 'read' || next.state === 'open') {
    return null;
  }

  const base = isEnded && settles && node.refused === null ? 0 : node.refused;

  const isRefusal =
    event === 'PreOther' && output.kind === 'refuse' && node.file.state !== 'reading';

  return base !== null && isRefusal ? base + 1 : base;
}

// I5: after a Stop that passes in wiped, the state is failed, and the next other call passes
// with the line once.
function checkFailOpenOnce(file: GateFile): string[] {
  const other: GateEvent = { kind: 'call', call: 'other-call' };
  const first = stepGate(file, bound, other, null);
  const second = stepGate(first.file ?? file, bound, other, null);

  const isHeld =
    file.state === 'failed' &&
    first.output.kind === 'pass-with-line' &&
    second.output.kind === 'pass';

  return isHeld ? [] : ['I5'];
}

// I3: with nothing running, a read that ends not whole opens the gate within one more refusal,
// or, when the host sends no end event, at the end of the turn.
function checkOpens(file: GateFile): string[] {
  const brief: GateEvent = { kind: 'call', call: 'brief-command' };
  const stop: GateEvent = { kind: 'stop', stopHookActive: false };

  const paths: readonly { readonly events: readonly GateEvent[]; readonly isLost: boolean }[] = [
    { events: [brief, { kind: 'end', end: 'failed' }], isLost: false },
    { events: [brief], isLost: true },
    { events: [brief, { kind: 'end', end: 'cut' }], isLost: false },
  ];

  return paths.flatMap((path, index) =>
    [false, true].flatMap((withStop) => {
      const events = withStop ? [...path.events, stop] : path.events;

      const isOpened = openAfter(
        events.reduce((current, event) => applyEvent(current, event), file),
      );

      const missed = withStop || (file.reads === 0 && !path.isLost);

      return !isOpened && missed ? [`I3:${String(index)}:${String(withStop)}`] : [];
    }),
  );
}

function openAfter(file: GateFile): boolean {
  const other: GateEvent = { kind: 'call', call: 'other-call' };
  const first = stepGate(file, bound, other, null);

  if (first.output.kind !== 'refuse') {
    return true;
  }

  return stepGate(first.file ?? file, bound, other, null).output.kind !== 'refuse';
}

function applyEvent(file: GateFile, event: GateEvent): GateFile {
  return stepGate(file, bound, event, null).file ?? file;
}
