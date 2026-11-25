import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { match } from 'ts-pattern';
import { formatHookOutput } from '../hooks/format-hook-output.ts';
import { gateTexts } from '../hooks/gate-texts.ts';
import { parseClaudeHookInput } from '../hooks/parse-claude-hook-input.ts';
import { parseCodexHookInput } from '../hooks/parse-codex-hook-input.ts';
import { pickPostToolWork } from '../hooks/pick-post-tool-work.ts';
import { readInjection } from '../hooks/read-injection.ts';
import { readShellCommand } from '../hooks/read-shell-command.ts';
import { runGateStep } from '../hooks/run-gate-step.ts';
import type { GateRun, GateTarget } from '../hooks/run-gate-step.ts';
import { runPostToolWork } from '../hooks/run-post-tool-work.ts';
import type { PostToolTarget } from '../hooks/run-post-tool-work.ts';
import { sortBriefEnd } from '../hooks/sort-brief-end.ts';
import type {
  GateEvent,
  Harness,
  HookContext,
  HookFault,
  HookInput,
  HookResult,
} from '../hooks/types.ts';
import { writeHookLog } from '../hooks/write-hook-log.ts';
import { readBinding } from '../sessions/read-binding.ts';

const empty: HookResult = { stdout: '', stderr: '', exitCode: 0 };

// What a debug line says of an event, filled in by its handler.
interface Trace {
  sorted: string;

  // for an end, the character count of the output read and whether it held a truncation marker
  detail: string;
  output: string;
  gate: string;
}

// Handles one event of one harness: parses the payload, reads the binding of the agent session
// id, and runs the event's handler. A hook exits 0 and logs its errors, except under the fault
// switch. It never creates a session or a store.
export async function runHookCommand(
  harness: Harness,
  stdinText: string,
  context: HookContext,
): Promise<HookResult> {
  const fault = readFault(context.root);

  if (fault === 'exit') {
    return { ...empty, exitCode: 1 };
  }

  if (fault === 'garbage') {
    return { ...empty, stdout: '{' };
  }

  if (fault === 'sleep') {
    await context.sleep(context.faultSleepMs);

    return empty;
  }

  const input =
    harness === 'claude' ? parseClaudeHookInput(stdinText) : parseCodexHookInput(stdinText);

  if (input === null) {
    writeHookLog(context, harness, 'unknown', 'the payload is not an event the hooks use');

    return empty;
  }

  const trace: Trace = { sorted: 'none', detail: '', output: 'none', gate: '-' };

  try {
    const name = await readBoundName(context, input);
    const stdout = await runEvent({ ...context, fault }, input, { name, trace });

    writeDebug(context, input, trace);

    return { ...empty, stdout };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'failed';

    writeHookLog(context, harness, input.event, message);
    writeDebug(context, input, { ...trace, output: 'error' });

    return empty;
  }
}

// A fault file that cannot be read is no fault: the hook runs as it would without the switch.
function readFault(root: string): HookFault | null {
  try {
    const value = readFileSync(join(root, 'hook-fault'), 'utf8').trim();

    return value === 'sleep' || value === 'exit' || value === 'garbage' || value === 'hold'
      ? value
      : null;
  } catch {
    return null;
  }
}

function readBoundName(context: HookContext, input: HookInput): Promise<string | null> {
  if (!/^[A-Za-z0-9-]+$/u.test(input.sessionID)) {
    return Promise.resolve(null);
  }

  return readBinding(context.root, { harness: input.harness, id: input.sessionID });
}

interface EventRun {
  readonly name: string | null;
  readonly trace: Trace;
}

function runEvent(context: HookContext, input: HookInput, run: EventRun): Promise<string> {
  const name = run.name;
  const trace = run.trace;

  if (name === null && input.event !== 'PostToolUse' && input.event !== 'PostToolUseFailure') {
    trace.sorted = 'unbound';

    return Promise.resolve('');
  }

  const target: GateTarget = {
    harness: input.harness,
    sessionID: input.sessionID,
    name: name ?? '',
  };

  return match(input)
    .with({ event: 'SessionStart' }, () => runSessionStart(context, target, trace))
    .with({ event: 'PreToolUse' }, (pre) => runPreToolUse(context, target, { input: pre, trace }))
    .with({ event: 'PostToolUse' }, { event: 'PostToolUseFailure' }, (post) =>
      runPostToolUse(context, { ...target, name }, { input: post, trace }),
    )
    .with({ event: 'SubagentStart' }, () => {
      trace.sorted = 'subagent-start';
      trace.output = 'pass-with-line';

      return Promise.resolve(
        formatHookOutput({
          output: { kind: 'pass' },
          event: 'SubagentStart',
          harness: target.harness,
          name: target.name,
          text: gateTexts.subagentLine(target.name),
        }),
      );
    })
    .with({ event: 'Stop' }, (stop) => runStop(context, target, { input: stop, trace }))
    .exhaustive();
}

async function runSessionStart(
  context: HookContext,
  target: GateTarget,
  trace: Trace,
): Promise<string> {
  const injection = await readInjectionOrNull(context, target);

  const run = await runGateStep(
    context,
    target,
    { kind: 'session-start' },
    { isStart: true, waitMs: 4000 },
  );

  traceRun(trace, run, 'session-start');

  if (injection === null) {
    writeHookLog(
      context,
      target.harness,
      'SessionStart',
      `the store of ${target.name} cannot be read`,
    );
  }

  return run.kind === 'ran' && injection !== null
    ? formatHookOutput({
        output: run.output,
        event: 'SessionStart',
        harness: target.harness,
        name: target.name,
        text: injection,
      })
    : '';
}

// A store whose `session` file cannot be read has no injection, and the wipe goes ahead: an old
// read state never survives a start or a compaction.
async function readInjectionOrNull(
  context: HookContext,
  target: GateTarget,
): Promise<string | null> {
  try {
    return await readInjection(
      join(context.root, target.name),
      target.name,
      target.harness,
      context.now(),
    );
  } catch {
    return null;
  }
}

function traceRun(trace: Trace, run: GateRun, sorted: string): void {
  trace.sorted = sorted;
  trace.output = run.kind === 'ran' ? run.output.kind : run.kind;
  trace.gate = run.kind === 'ran' ? (run.line?.trim() ?? 'unchanged') : '-';
}

interface PreToolUseRun {
  readonly input: Extract<HookInput, { event: 'PreToolUse' }>;
  readonly trace: Trace;
}

async function runPreToolUse(
  context: HookContext,
  target: GateTarget,
  pre: PreToolUseRun,
): Promise<string> {
  const input = pre.input;

  if (input.agentID !== null) {
    pre.trace.sorted = 'subagent';

    return '';
  }

  const kind =
    input.toolName === 'Bash' && input.command !== null
      ? readShellCommand(input.command, target.name, target.harness)
      : 'other';

  const call = match(kind)
    .with('brief-command', () => 'brief-command' as const)
    .with('www-command', () => 'www-command' as const)
    .with('other', () => 'other-call' as const)
    .exhaustive();

  const run = await runGateStep(
    context,
    target,
    { kind: 'call', call },
    { isStart: false, waitMs: 2000 },
  );

  traceRun(pre.trace, run, call);

  return formatRun(target, 'PreToolUse', run);
}

function formatRun(target: GateTarget, event: 'PreToolUse' | 'Stop', run: GateRun): string {
  return run.kind === 'ran'
    ? formatHookOutput({
        output: run.output,
        event,
        harness: target.harness,
        name: target.name,
        text: '',
      })
    : '';
}

interface PostToolUseRun {
  readonly input: Extract<HookInput, { event: 'PostToolUse' | 'PostToolUseFailure' }>;
  readonly trace: Trace;
}

async function runPostToolUse(
  context: HookContext,
  target: PostToolTarget,
  post: PostToolUseRun,
): Promise<string> {
  const input = post.input;
  const end = target.name === null ? null : sortBriefEnd(input, target.name);

  if (target.name !== null && end !== null) {
    const run = await runGateStep(
      context,
      { ...target, name: target.name },
      { kind: 'end', end },
      { isStart: false, waitMs: 4000 },
    );

    traceRun(post.trace, run, end);

    post.trace.detail = describeResponse(input);
  } else {
    post.trace.sorted = target.name === null ? 'unbound' : 'other-call';
  }

  const isSuccess =
    input.event === 'PostToolUse' && (input.exitCode === null || input.exitCode === 0);

  if (!isSuccess) {
    return '';
  }

  const nudge = await runPostToolWork(
    context,
    target,
    pickPostToolWork(input.command, input.response, target.harness),
  );

  if (nudge !== null) {
    post.trace.output = 'nudge';
  }

  return nudge === null
    ? ''
    : formatHookOutput({
        output: { kind: 'pass' },
        event: 'PostToolUse',
        harness: target.harness,
        name: target.name ?? '',
        text: nudge,
      });
}

function describeResponse(input: HookInput): string {
  if (input.event !== 'PostToolUse') {
    return 'chars=0 marker=false';
  }

  const hasMarker =
    input.response.includes('<persisted-output>') || input.response.includes('tokens truncated');

  return `chars=${String(input.response.length)} marker=${String(hasMarker)}`;
}

interface StopRun {
  readonly input: Extract<HookInput, { event: 'Stop' }>;
  readonly trace: Trace;
}

async function runStop(context: HookContext, target: GateTarget, stop: StopRun): Promise<string> {
  if (stop.input.agentID !== null) {
    stop.trace.sorted = 'subagent';

    return '';
  }

  const event: GateEvent = { kind: 'stop', stopHookActive: stop.input.stopHookActive };

  const run = await runGateStep(context, target, event, { isStart: false, waitMs: 2000 });

  const sorted = stop.input.stopHookActive ? 'stop-active' : 'stop';

  traceRun(stop.trace, run, sorted);

  return formatRun(target, 'Stop', run);
}

// One line per event when a file named `hook-debug` is in the store root: the event, the sorted
// call or end, the kind of the output and the gate file line, and never the output's text.
function writeDebug(context: HookContext, input: HookInput, trace: Trace): void {
  if (!existsSync(join(context.root, 'hook-debug'))) {
    return;
  }

  const agentID = 'agentID' in input ? input.agentID : null;
  const detail = trace.detail === '' ? '' : `${trace.detail} `;

  writeHookLog(
    context,
    input.harness,
    input.event,
    `debug session=${input.sessionID} agent=${agentID ?? '-'} sorted=${trace.sorted} ${detail}output=${trace.output} gate=${trace.gate}`,
  );
}
