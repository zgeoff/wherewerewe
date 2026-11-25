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

  try {
    const name = await readBoundName(context, input);
    const stdout = await runEvent({ ...context, fault }, input, name);

    return { ...empty, stdout };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'failed';

    writeHookLog(context, harness, input.event, message);

    return empty;
  }
}

function readFault(root: string): HookFault | null {
  const path = join(root, 'hook-fault');

  if (!existsSync(path)) {
    return null;
  }

  const value = readFileSync(path, 'utf8').trim();

  return value === 'sleep' || value === 'exit' || value === 'garbage' || value === 'hold'
    ? value
    : null;
}

function readBoundName(context: HookContext, input: HookInput): Promise<string | null> {
  if (!/^[A-Za-z0-9-]+$/u.test(input.sessionID)) {
    return Promise.resolve(null);
  }

  return readBinding(context.root, { harness: input.harness, id: input.sessionID });
}

function runEvent(context: HookContext, input: HookInput, name: string | null): Promise<string> {
  if (name === null && input.event !== 'PostToolUse') {
    return Promise.resolve('');
  }

  const target: GateTarget = {
    harness: input.harness,
    sessionID: input.sessionID,
    name: name ?? '',
  };

  return match(input)
    .with({ event: 'SessionStart' }, () => runSessionStart(context, target))
    .with({ event: 'PreToolUse' }, (pre) => runPreToolUse(context, target, pre))
    .with({ event: 'PostToolUse' }, { event: 'PostToolUseFailure' }, (post) =>
      runPostToolUse(context, { ...target, name }, post),
    )
    .with({ event: 'SubagentStart' }, () =>
      Promise.resolve(
        formatHookOutput({
          output: { kind: 'pass' },
          event: 'SubagentStart',
          harness: target.harness,
          name: target.name,
          text: gateTexts.subagentLine(target.name),
        }),
      ),
    )
    .with({ event: 'Stop' }, (stop) => runStop(context, target, stop))
    .exhaustive();
}

async function runSessionStart(context: HookContext, target: GateTarget): Promise<string> {
  const injection = await readInjection(
    join(context.root, target.name),
    target.name,
    target.harness,
    context.now(),
  );

  const run = await runGateStep(
    context,
    target,
    { kind: 'session-start' },
    { isStart: true, waitMs: 4000 },
  );

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

async function runPreToolUse(
  context: HookContext,
  target: GateTarget,
  input: Extract<HookInput, { event: 'PreToolUse' }>,
): Promise<string> {
  if (input.agentID !== null) {
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

  return finishRun(context, target, 'PreToolUse', { run, sorted: call, agentID: null });
}

interface RunReport {
  readonly run: GateRun;
  readonly sorted: string;
  readonly agentID: string | null;

  // for an end, the character count of the output read and whether it held a truncation marker
  readonly detail?: string;
}

function finishRun(
  context: HookContext,
  target: GateTarget,
  event: 'PreToolUse' | 'Stop',
  report: RunReport,
): string {
  writeDebug(context, target, event, report);

  return report.run.kind === 'ran'
    ? formatHookOutput({
        output: report.run.output,
        event,
        harness: target.harness,
        name: target.name,
        text: '',
      })
    : '';
}

interface DebugTarget {
  readonly harness: Harness;
  readonly sessionID: string;
}

// One line per event when a file named `hook-debug` is in the store root: the sorted call or end,
// the kind of the output and the gate file line, and never the output's text.
function writeDebug(
  context: HookContext,
  target: DebugTarget,
  event: string,
  report: RunReport,
): void {
  if (!existsSync(join(context.root, 'hook-debug'))) {
    return;
  }

  const output = report.run.kind === 'ran' ? report.run.output.kind : report.run.kind;
  const line = report.run.kind === 'ran' ? (report.run.line?.trim() ?? 'unchanged') : '-';

  writeHookLog(
    context,
    target.harness,
    event,
    `debug session=${target.sessionID} agent=${report.agentID ?? '-'} sorted=${report.sorted} ${report.detail ?? ''} output=${output} gate=${line}`.replace(
      '  ',
      ' ',
    ),
  );
}

async function runPostToolUse(
  context: HookContext,
  target: PostToolTarget,
  input: Extract<HookInput, { event: 'PostToolUse' | 'PostToolUseFailure' }>,
): Promise<string> {
  const end = target.name === null ? null : sortBriefEnd(input, target.name);

  if (target.name !== null && end !== null) {
    const run = await runGateStep(
      context,
      { ...target, name: target.name },
      { kind: 'end', end },
      { isStart: false, waitMs: 4000 },
    );

    writeDebug(context, target, 'PostToolUse', {
      run,
      sorted: end,
      agentID: null,
      detail: describeResponse(input),
    });
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

async function runStop(
  context: HookContext,
  target: GateTarget,
  input: Extract<HookInput, { event: 'Stop' }>,
): Promise<string> {
  if (input.agentID !== null) {
    return '';
  }

  const event: GateEvent = { kind: 'stop', stopHookActive: input.stopHookActive };

  const run = await runGateStep(context, target, event, { isStart: false, waitMs: 2000 });

  return finishRun(context, target, 'Stop', { run, sorted: 'stop', agentID: null });
}
