import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { match } from 'ts-pattern';
import { briefFooter } from '../brief/join-brief.ts';
import { runHookCommand } from '../commands/run-hook-command.ts';
import { parseGateFile } from '../hooks/parse-gate-file.ts';
import { stepGate } from '../hooks/step-gate.ts';
import type { GateEvent, GateFile, GateOutput, Harness } from '../hooks/types.ts';
import { writeBinding } from '../sessions/write-binding.ts';
import { buildHookContext } from './build-hook-context.ts';
import { buildHookPayload } from './build-hook-payload.ts';
import type { HookPayloadSpec } from './build-hook-payload.ts';
import { readGateLine } from './read-gate-line.ts';
import { seedHookStore } from './seed-hook-store.ts';
import { toHookDecision } from './to-hook-decision.ts';
import type { HookDecision } from './to-hook-decision.ts';

export type HookModelPayload =
  | 'start'
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

// Runs the operations through the real hook command over a temp store root, and through a model
// that advances the same step function over the binding table, and returns each place they or an
// invariant of the design disagree. The model and the real files must agree after every operation.
export async function runHookModel(
  harness: Harness,
  ops: readonly HookModelOp[],
): Promise<readonly string[]> {
  const root = createTempDir('hook-model').path;
  const context = buildHookContext(root);

  await seedHookStore(root, { harness, id: agent.id }, 'tide-alerts');
  await seedHookStore(root, { harness, id: 'eeee-other' }, 'docs-move');

  const problems: string[] = [];
  let state: ModelState = { file: null, binding: 'tide-alerts' };

  // the brief commands the main agent started and no end event closed, counted apart from the gate
  let inflight = 0;

  // whether a wipe closed the gate and no whole read or passed call opened it since, kept apart too
  let isGateClosed = false;

  for (const [index, op] of ops.entries()) {
    const label = `op ${String(index)} ${JSON.stringify(op)}`;
    const before = readGateLine(root, `${harness}-${agent.id}`);
    const prior = state.file;

    const outcome = await runOp({ harness, root, context, op }, state, problems, label);

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
}

interface Outcome {
  readonly state: ModelState;
  readonly decision: HookDecision;
}

function runOp(run: OpRun, state: ModelState, problems: string[], label: string): Promise<Outcome> {
  return match(run.op)
    .with({ kind: 'attach' }, async (): Promise<Outcome> => {
      await writeBinding(run.root, { harness: run.harness, id: agent.id }, 'docs-move');

      return { state: { ...state, binding: 'docs-move' }, decision: 'pass' };
    })
    .with({ kind: 'call' }, async (call): Promise<Outcome> => {
      const stdout = await runCall(run, call);

      const expected = advance(state, call, run.harness);
      const decision = toHookDecision(stdout.stdout);

      if (decision !== expected.decision) {
        problems.push(`${label}: printed ${decision}, the model has ${expected.decision}`);
      }

      return { state: expected.state, decision };
    })
    .with({ kind: 'together' }, async (together): Promise<Outcome> => {
      const [firstOut, secondOut] = await Promise.all([
        runCall(run, together.first),
        runCall(run, together.second),
      ]);

      const firstThenSecond = advanceBoth(state, together, run.harness, 'first-first');
      const secondThenFirst = advanceBoth(state, together, run.harness, 'second-first');
      const seen = [toHookDecision(firstOut.stdout), toHookDecision(secondOut.stdout)];
      const actual = parseGateFile(readGateLine(run.root, `${run.harness}-${agent.id}`) ?? '');

      const chosen = [firstThenSecond, secondThenFirst].find(
        (order) =>
          JSON.stringify(order.decisions) === JSON.stringify(seen) &&
          JSON.stringify(order.state.file) === JSON.stringify(actual),
      );

      if (chosen === undefined) {
        problems.push(`${label}: matches neither serial order: ${seen.join(',')}`);
      }

      return { state: chosen?.state ?? { ...state, file: actual }, decision: seen[0] ?? 'pass' };
    })
    .exhaustive();
}

function runCall(run: OpRun, call: HookModelCall): Promise<{ stdout: string }> {
  const sessionID = call.from === 'unbound' ? agent.unbound : agent.id;
  const spec = toSpec(call);

  return runHookCommand(run.harness, buildHookPayload(run.harness, sessionID, spec), run.context);
}

function toSpec(call: HookModelCall): HookPayloadSpec {
  const agentID = call.from === 'subagent' ? 'sub-1' : undefined;
  const withAgent = agentID === undefined ? {} : { agentID };
  const whole = `tide-alerts · day 1 · Tue 2026-03-10 11:43Z · no checks\nGOAL  Ship it\n${briefFooter}\n`;

  return match(call.payload)
    .with('start', (): HookPayloadSpec => ({ event: 'SessionStart' }))
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

// What the model expects of one call: the gate event its payload sorts to, advanced by the step
// function, or no change for a payload of a subagent or of an unbound id.
function advance(
  state: ModelState,
  call: HookModelCall,
  harness: Harness,
): { readonly state: ModelState; readonly decision: HookDecision } {
  const event = toGateEvent(call.payload, harness, state.binding);

  if (call.from === 'unbound' || event === null) {
    return { state, decision: 'pass' };
  }

  const agentID = call.from === 'subagent' ? 'sub-1' : null;
  const step = stepGate(state.file, state.binding, event, agentID);
  const needsFile = event.kind !== 'session-start' && state.file === null;
  const decision = needsFile ? 'pass' : toDecision(step.output);

  return { state: { ...state, file: step.file ?? state.file }, decision };
}

function toGateEvent(
  payload: HookModelPayload,
  harness: Harness,
  binding: string,
): GateEvent | null {
  const isBound = binding === 'tide-alerts';

  return match(payload)
    .with('start', (): GateEvent => ({ kind: 'session-start' }))
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

function toDecision(output: GateOutput): HookDecision {
  return match(output)
    .with({ kind: 'refuse', reason: 'cut' }, (): HookDecision => 'refuse-cut')
    .with({ kind: 'refuse' }, (): HookDecision => 'refuse')
    .with({ kind: 'pass-with-line' }, (): HookDecision => 'pass+line')
    .with({ kind: 'block' }, (): HookDecision => 'block')
    .with({ kind: 'inject' }, (): HookDecision => 'inject')
    .with({ kind: 'pass' }, { kind: 'none' }, (): HookDecision => 'pass')
    .exhaustive();
}

interface HookModelPair {
  readonly first: HookModelCall;
  readonly second: HookModelCall;
}

function advanceBoth(
  state: ModelState,
  together: HookModelPair,
  harness: Harness,
  order: 'first-first' | 'second-first',
): { readonly state: ModelState; readonly decisions: readonly HookDecision[] } {
  const calls =
    order === 'first-first' ? [together.first, together.second] : [together.second, together.first];

  const [one, two] = calls;
  const afterOne = advance(state, one ?? together.first, harness);
  const afterTwo = advance(afterOne.state, two ?? together.second, harness);

  const decisions =
    order === 'first-first'
      ? [afterOne.decision, afterTwo.decision]
      : [afterTwo.decision, afterOne.decision];

  return { state: afterTwo.state, decisions };
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

  if (op.payload === 'start') {
    return true;
  }

  if (op.payload === 'end-whole') {
    return false;
  }

  const isOtherCall = op.payload === 'pre-ls' || op.payload === 'pre-mcp';

  return isOtherCall && decision !== 'refuse' ? false : isClosed;
}
