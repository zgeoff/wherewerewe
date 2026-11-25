import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { setImmediate } from 'node:timers/promises';
import { createTempDir } from '@zgeoff/testing/fs';
import type fc from 'fast-check';
import { match } from 'ts-pattern';
import { briefFooter } from '../brief/join-brief.ts';
import { runHookCommand } from '../commands/run-hook-command.ts';
import { parseGateFile } from '../hooks/parse-gate-file.ts';
import { readInjection } from '../hooks/read-injection.ts';
import { stepGate } from '../hooks/step-gate.ts';
import type { GateEvent, GateFile, Harness } from '../hooks/types.ts';
import { readBinding } from '../sessions/read-binding.ts';
import { buildHookContext } from './build-hook-context.ts';
import { buildHookPayload } from './build-hook-payload.ts';
import type { HookPayloadSpec } from './build-hook-payload.ts';
import { formatExpectedHookOutput } from './format-expected-hook-output.ts';
import { readGateLine } from './read-gate-line.ts';
import { seedHookStore } from './seed-hook-store.ts';
import { toHookDecision } from './to-hook-decision.ts';
import type { HookDecision } from './to-hook-decision.ts';

export type HookModelPayload =
  | 'start-startup'
  | 'start-resume'
  | 'start-clear'
  | 'start-compact'
  | 'start-fork'
  | 'subagent-start'
  | 'pre-brief'
  | 'pre-brief-session'
  | 'pre-www-list'
  | 'pre-www-pipe'
  | 'pre-ls'
  | 'pre-mcp'
  | 'end-whole'
  | 'end-cut'
  | 'end-failed'
  | 'stop'
  | 'stop-active';

export interface HookModelCall {
  readonly payload: HookModelPayload;

  // main: the agent's own payload; subagent: one with agent_id; unbound: one of an unbound id
  readonly from: 'main' | 'subagent' | 'unbound';
}

export type HookModelOp =
  | ({ readonly kind: 'call' } & HookModelCall)
  | { readonly kind: 'attach' }
  | { readonly kind: 'together'; readonly first: HookModelCall; readonly second: HookModelCall };

interface ModelState {
  readonly file: GateFile | null;

  // the wherewerewe session the agent session id is bound to
  readonly binding: string;
}

const agent = { id: '9e1f-trial', unbound: 'ffff-unbound' };

// Runs the operations through the real hook command over a temp store root and through a model that
// advances the same step function, and returns each place they or an invariant disagree. Each
// stdout must be the model's output whole. Two hooks run together in the scheduler's order.
export async function runHookModel(
  harness: Harness,
  ops: readonly HookModelOp[],
  scheduler: fc.Scheduler,
): Promise<readonly string[]> {
  const root = createTempDir('hook-model').path;
  const context = buildHookContext(root);

  await seedHookStore(root, { harness, id: agent.id }, 'tide-alerts');
  await seedHookStore(root, { harness, id: 'eeee-other' }, 'docs-move');

  const problems: string[] = [];

  const injections = {
    'tide-alerts': await readInjection(
      join(root, 'tide-alerts'),
      'tide-alerts',
      harness,
      context.now(),
    ),
    'docs-move': await readInjection(join(root, 'docs-move'), 'docs-move', harness, context.now()),
  };

  let state: ModelState = { file: null, binding: 'tide-alerts' };

  // the brief commands the main agent started and no end event closed, counted apart from the gate
  let inflight = 0;

  // whether a wipe closed the gate and no whole read or passed call opened it since, kept apart too
  let isGateClosed = false;

  for (const [index, op] of ops.entries()) {
    const label = `op ${String(index)} ${JSON.stringify(op)}`;
    const before = readGateLine(root, `${harness}-${agent.id}`);
    const prior = state.file;

    const outcome = await runOp(
      { harness, root, context, op, scheduler, injections },
      state,
      problems,
      label,
    );

    state = outcome.state;

    const file = parseGateFile(readGateLine(root, `${harness}-${agent.id}`) ?? '');

    if (JSON.stringify(file) !== JSON.stringify(state.file)) {
      problems.push(
        `${label}: the file is ${JSON.stringify(file)}, the model has ${JSON.stringify(state.file)}`,
      );
    }

    problems.push(
      ...checkInvariants(
        op,
        { before, prior, inflight, isGateClosed, state, outcome, root: { harness, root } },
        label,
      ),
    );

    inflight = countInflight(inflight, op, state.binding);
    isGateClosed = isClosedAfter(isGateClosed, op, outcome.decision);
  }

  return problems;
}

interface OpRun {
  readonly harness: Harness;
  readonly root: string;
  readonly context: ReturnType<typeof buildHookContext>;
  readonly op: HookModelOp;
  readonly scheduler: fc.Scheduler;

  // what a SessionStart prints for each store, read from the store as the brief is
  readonly injections: Readonly<Record<string, string | null>>;
}

interface Outcome {
  readonly state: ModelState;
  readonly decision: HookDecision;
}

function runOp(run: OpRun, state: ModelState, problems: string[], label: string): Promise<Outcome> {
  return match(run.op)
    .with({ kind: 'attach' }, async (): Promise<Outcome> => {
      const result = await runHookCommand(
        run.harness,
        buildHookPayload(run.harness, agent.id, {
          event: 'PostToolUse',
          command: 'www attach docs-move',
          output: 'attached',
        }),
        run.context,
      );

      const bound = await readBinding(run.root, { harness: run.harness, id: agent.id });

      if (result.stdout !== '' || bound !== 'docs-move') {
        problems.push(`${label}: the attach printed ${result.stdout} and bound ${String(bound)}`);
      }

      return { state: { ...state, binding: 'docs-move' }, decision: 'pass' };
    })
    .with({ kind: 'call' }, async (call): Promise<Outcome> => {
      const stdout = await runCall(run, call, run.context);

      const expected = advance(state, call, run);
      const decision = toHookDecision(stdout.stdout);

      if (stdout.stdout !== expected.stdout) {
        problems.push(
          `${label}: printed ${JSON.stringify(stdout.stdout)}, the model has ${JSON.stringify(expected.stdout)}`,
        );
      }

      return { state: expected.state, decision };
    })
    .with({ kind: 'together' }, async (together): Promise<Outcome> => {
      // the scheduler decides which hook starts first and when a hook that waits for the lock
      // tries again; each wait also yields to the event loop, so the holder can finish its reads
      const waiting = {
        ...run.context,
        sleep: async () => {
          await run.scheduler.schedule(Promise.resolve());

          await setImmediate();
        },
      };

      const [firstOut, secondOut] = await run.scheduler.waitFor(
        Promise.all([
          runScheduled(run, together.first, waiting),
          runScheduled(run, together.second, waiting),
        ]),
      );

      const firstThenSecond = advanceBoth(state, together, run, 'first-first');
      const secondThenFirst = advanceBoth(state, together, run, 'second-first');
      const seen = [firstOut.stdout, secondOut.stdout];
      const actual = parseGateFile(readGateLine(run.root, `${run.harness}-${agent.id}`) ?? '');

      const chosen = [firstThenSecond, secondThenFirst].find(
        (order) =>
          JSON.stringify(order.stdouts) === JSON.stringify(seen) &&
          JSON.stringify(order.state.file) === JSON.stringify(actual),
      );

      if (chosen === undefined) {
        problems.push(`${label}: matches neither serial order: ${JSON.stringify(seen)}`);
      }

      return {
        state: chosen?.state ?? { ...state, file: actual },
        decision: toHookDecision(seen[0] ?? ''),
      };
    })
    .exhaustive();
}

function runCall(
  run: OpRun,
  call: HookModelCall,
  context: OpRun['context'],
): Promise<{ stdout: string }> {
  const sessionID = call.from === 'unbound' ? agent.unbound : agent.id;
  const spec = toSpec(call);

  return runHookCommand(run.harness, buildHookPayload(run.harness, sessionID, spec), context);
}

function toSpec(call: HookModelCall): HookPayloadSpec {
  const agentID = call.from === 'subagent' ? 'sub-1' : undefined;
  const withAgent = agentID === undefined ? {} : { agentID };
  const whole = `tide-alerts · day 1 · Tue 2026-03-10 11:43Z · no checks\nGOAL  Ship it\n${briefFooter}\n`;

  return match(call.payload)
    .with('start-startup', (): HookPayloadSpec => ({ event: 'SessionStart', source: 'startup' }))
    .with('start-resume', (): HookPayloadSpec => ({ event: 'SessionStart', source: 'resume' }))
    .with('start-clear', (): HookPayloadSpec => ({ event: 'SessionStart', source: 'clear' }))
    .with('start-compact', (): HookPayloadSpec => ({ event: 'SessionStart', source: 'compact' }))
    .with('start-fork', (): HookPayloadSpec => ({ event: 'SessionStart', source: 'fork' }))
    .with('subagent-start', (): HookPayloadSpec => ({ event: 'SubagentStart' }))
    .with('pre-brief', (): HookPayloadSpec => ({
      event: 'PreToolUse',
      command: 'www',
      ...withAgent,
    }))
    .with('pre-brief-session', (): HookPayloadSpec => ({
      event: 'PreToolUse',
      command: 'www --session tide-alerts',
      ...withAgent,
    }))
    .with('pre-www-list', (): HookPayloadSpec => ({
      event: 'PreToolUse',
      command: 'www list rules',
      ...withAgent,
    }))
    .with('pre-www-pipe', (): HookPayloadSpec => ({
      event: 'PreToolUse',
      command: 'www | tail -1',
      ...withAgent,
    }))
    .with('pre-ls', (): HookPayloadSpec => ({ event: 'PreToolUse', command: 'ls', ...withAgent }))
    .with('pre-mcp', (): HookPayloadSpec => ({
      event: 'PreToolUse',
      command: null,
      toolName: 'mcp__tides__lookup',
      ...withAgent,
    }))
    .with('end-whole', (): HookPayloadSpec => ({
      event: 'PostToolUse',
      command: 'www',
      output: whole,
      ...withAgent,
    }))
    .with('end-cut', (): HookPayloadSpec => ({
      event: 'PostToolUse',
      command: 'www',
      output: whole.replace('GOAL', '…3000 tokens truncated…\nGOAL'),
      ...withAgent,
    }))
    .with('end-failed', (): HookPayloadSpec => ({
      event: 'PostToolUse',
      command: 'www',
      output: 'www: command not found',
      ...withAgent,
    }))
    .with('stop', (): HookPayloadSpec => ({ event: 'Stop', ...withAgent }))
    .with('stop-active', (): HookPayloadSpec => ({
      event: 'Stop',
      stopHookActive: true,
      ...withAgent,
    }))
    .exhaustive();
}

// What the model expects a call to print and to leave in the gate file.
interface Advance {
  readonly state: ModelState;
  readonly stdout: string;
}

// What the model expects of one call: the gate event its payload sorts to, advanced by the step
// function, or no change for a payload of an unbound id, and the stdout of that event in the
// host's shape, whole.
function advance(state: ModelState, call: HookModelCall, run: OpRun): Advance {
  if (call.from === 'unbound') {
    return { state, stdout: '' };
  }

  if (call.payload === 'subagent-start') {
    return {
      state,
      stdout: formatExpectedHookOutput({
        event: 'SubagentStart',
        output: { kind: 'pass' },
        harness: run.harness,
        name: state.binding,
        injection: '',
      }),
    };
  }

  const event = toGateEvent(call.payload, run.harness, state.binding);

  if (event === null) {
    return { state, stdout: '' };
  }

  const agentID = call.from === 'subagent' ? 'sub-1' : null;
  const step = stepGate(state.file, state.binding, event, agentID);
  const needsFile = event.kind !== 'session-start' && state.file === null;

  const stdout = needsFile
    ? ''
    : formatExpectedHookOutput({
        event: toEventName(event),
        output: step.output,
        harness: run.harness,
        name: state.binding,
        injection: run.injections[state.binding] ?? '',
      });

  return { state: { ...state, file: step.file ?? state.file }, stdout };
}

function toGateEvent(
  payload: HookModelPayload,
  harness: Harness,
  binding: string,
): GateEvent | null {
  const isBound = binding === 'tide-alerts';

  return match(payload)
    .with(
      'start-startup',
      'start-resume',
      'start-clear',
      'start-compact',
      'start-fork',
      (): GateEvent => ({
        kind: 'session-start',
      }),
    )
    .with('subagent-start', () => null)
    .with('pre-brief', (): GateEvent => ({ kind: 'call', call: 'brief-command' }))
    .with('pre-brief-session', (): GateEvent => ({
      kind: 'call',
      call: isBound ? 'brief-command' : 'www-command',
    }))
    .with('pre-www-list', 'pre-www-pipe', (): GateEvent => ({ kind: 'call', call: 'www-command' }))
    .with('pre-ls', 'pre-mcp', (): GateEvent => ({ kind: 'call', call: 'other-call' }))
    .with('end-whole', (): GateEvent => ({ kind: 'end', end: isBound ? 'whole' : 'failed' }))
    .with('end-cut', (): GateEvent => ({
      kind: 'end',
      end: isBound && harness === 'codex' ? 'cut' : 'failed',
    }))
    .with('end-failed', (): GateEvent => ({ kind: 'end', end: 'failed' }))
    .with('stop', (): GateEvent => ({ kind: 'stop', stopHookActive: false }))
    .with('stop-active', (): GateEvent => ({ kind: 'stop', stopHookActive: true }))
    .exhaustive();
}

function toEventName(event: GateEvent): 'SessionStart' | 'PreToolUse' | 'Stop' {
  return match(event)
    .with({ kind: 'session-start' }, () => 'SessionStart' as const)
    .with({ kind: 'stop' }, () => 'Stop' as const)
    .with({ kind: 'call' }, { kind: 'end' }, () => 'PreToolUse' as const)
    .exhaustive();
}

async function runScheduled(
  run: OpRun,
  call: HookModelCall,
  context: OpRun['context'],
): Promise<{ stdout: string }> {
  await run.scheduler.schedule(Promise.resolve());

  return runCall(run, call, context);
}

interface HookModelPair {
  readonly first: HookModelCall;
  readonly second: HookModelCall;
}

function advanceBoth(
  state: ModelState,
  together: HookModelPair,
  run: OpRun,
  order: 'first-first' | 'second-first',
): { readonly state: ModelState; readonly stdouts: readonly string[] } {
  const calls =
    order === 'first-first' ? [together.first, together.second] : [together.second, together.first];

  const [one, two] = calls;
  const afterOne = advance(state, one ?? together.first, run);
  const afterTwo = advance(afterOne.state, two ?? together.second, run);

  const stdouts =
    order === 'first-first'
      ? [afterOne.stdout, afterTwo.stdout]
      : [afterTwo.stdout, afterOne.stdout];

  return { state: afterTwo.state, stdouts };
}

interface InvariantInput {
  readonly before: string | null;

  // the gate file before the operation, as the model holds it
  readonly prior: GateFile | null;

  // the brief commands of the main agent in flight before the operation
  readonly inflight: number;
  readonly isGateClosed: boolean;
  readonly state: ModelState;
  readonly outcome: Outcome;
  readonly root: { readonly harness: Harness; readonly root: string };
}

// The design's invariants on the real outputs, from the real files and what the hook printed: a
// payload of a subagent or of an unbound id changes nothing and prints nothing, and a call of the
// main agent while a brief command runs in a closed gate is refused.
function checkInvariants(op: HookModelOp, input: InvariantInput, label: string): string[] {
  if (op.kind !== 'call') {
    return [];
  }

  const after = readGateLine(input.root.root, `${input.root.harness}-${agent.id}`);
  const isQuiet = op.from !== 'main';
  const problems: string[] = [];

  if (isQuiet && (after !== input.before || input.outcome.decision !== 'pass')) {
    problems.push(`${label}: a payload that is not the main agent's changed or printed something`);
  }

  if (
    op.from === 'unbound' &&
    existsSync(join(input.root.root, '.gate')) &&
    readdirSync(join(input.root.root, '.gate')).some((name) => name.includes('unbound'))
  ) {
    problems.push(`${label}: an unbound id got a gate file`);
  }

  return [...problems, ...checkMainCall(op, input, after, label)];
}

// Invariants 1 and 2 and the I5 of the walk, on what the real hook printed and wrote: a call of the
// main agent is refused while a brief command runs in a closed gate, passes with the line once in
// a failed gate, and passes with no line after.
function checkMainCall(
  op: Extract<HookModelOp, { kind: 'call' }>,
  input: InvariantInput,
  after: string | null,
  label: string,
): string[] {
  const isOtherCall = op.payload === 'pre-ls' || op.payload === 'pre-mcp';
  const isAnotherSession = input.prior?.session !== input.state.binding;

  if (op.from !== 'main' || !isOtherCall || input.prior === null || isAnotherSession) {
    return [];
  }

  const decision = input.outcome.decision;
  const prior = input.prior;

  const failures = [
    ...(input.isGateClosed && input.inflight > 0 && decision !== 'refuse' ? ['invariant 1'] : []),
    ...(prior.state === 'failed' &&
    (decision !== 'pass+line' || !(after ?? '').includes('state=open'))
      ? ['a failed gate opens with the line once']
      : []),
    ...(['open', 'read'].includes(prior.state) && decision !== 'pass'
      ? ['an open gate passes']
      : []),
  ];

  return failures.map((failure) => `${label}: ${failure}`);
}

// A brief command of the main agent adds one, each end event takes one away, and a Stop clears
// them: the count the design's first invariant is about, kept apart from the gate file.
function countInflight(inflight: number, op: HookModelOp, binding: string): number {
  const calls = match(op)
    .with({ kind: 'call' }, (call) => [call])
    .with({ kind: 'together' }, (together) => [together.first, together.second])
    .with({ kind: 'attach' }, () => [])
    .exhaustive();

  return calls
    .filter((call) => call.from === 'main')
    .reduce((count, call) => {
      if (
        call.payload === 'pre-brief' ||
        (call.payload === 'pre-brief-session' && binding === 'tide-alerts')
      ) {
        return count + 1;
      }

      if (call.payload.startsWith('end-')) {
        return Math.max(count - 1, 0);
      }

      return call.payload.startsWith('stop') ? 0 : count;
    }, inflight);
}

// A SessionStart of the main agent and an attach close the gate; a whole read of the bound
// session and any other call that passed open it.
function isClosedAfter(isClosed: boolean, op: HookModelOp, decision: HookDecision): boolean {
  if (op.kind === 'attach') {
    return true;
  }

  if (op.kind !== 'call' || op.from !== 'main') {
    return isClosed;
  }

  if (op.payload.startsWith('start-')) {
    return true;
  }

  if (op.payload === 'end-whole') {
    return false;
  }

  const isOtherCall = op.payload === 'pre-ls' || op.payload === 'pre-mcp';

  return isOtherCall && decision !== 'refuse' ? false : isClosed;
}
