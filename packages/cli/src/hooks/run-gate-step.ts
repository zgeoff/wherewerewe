import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { match } from 'ts-pattern';
import { readTextOrNull } from '../store/read-text-or-null.ts';
import { writeFileAtomic } from '../store/write-file-atomic.ts';
import { formatGateFile } from './format-gate-file.ts';
import { parseGateFile } from './parse-gate-file.ts';
import { stepGate } from './step-gate.ts';
import type { GateEvent, GateOutput, Harness, HookContext } from './types.ts';
import { withGateLock } from './with-gate-lock.ts';
import { writeHookLog } from './write-hook-log.ts';

export interface GateTarget {
  readonly harness: Harness;
  readonly sessionID: string;
  readonly name: string;
}

export type GateRun =
  | { readonly kind: 'ran'; readonly output: GateOutput; readonly line: string | null }

  // no gate file: the session was never gated
  | { readonly kind: 'no-file' }

  // the lock was busy, a file did not parse, or the lock could not be taken: the call runs
  | { readonly kind: 'skipped' };

export interface GateStepOptions {
  // a SessionStart makes the folder and replaces a file that does not parse
  readonly isStart: boolean;
  readonly waitMs: number;
}

interface StepRequest {
  readonly context: HookContext;
  readonly gatePath: string;
  readonly target: GateTarget;
  readonly event: GateEvent;
  readonly isStart: boolean;
}

// Reads the gate file, applies the event and writes the result, all inside one lock of its own.
export async function runGateStep(
  context: HookContext,
  target: GateTarget,
  event: GateEvent,
  options: GateStepOptions,
): Promise<GateRun> {
  const gatePath = join(context.root, '.gate', `${target.harness}-${target.sessionID}`);
  const eventName = event.kind;

  if (options.isStart) {
    mkdirSync(dirname(gatePath), { recursive: true });
  } else if (!existsSync(gatePath)) {
    return { kind: 'no-file' };
  }

  const step: StepRequest = { context, gatePath, target, event, isStart: options.isStart };

  const locked = await withGateLock(gatePath, () => applyStep(step), {
    waitMs: options.waitMs,
    sleep: context.sleep,
  });

  return match(locked)
    .with({ kind: 'ran' }, (ran) => ran.value)
    .with({ kind: 'busy' }, (): GateRun => {
      writeHookLog(context, target.harness, eventName, 'the gate lock was busy; the call runs');

      return { kind: 'skipped' };
    })
    .with({ kind: 'unavailable' }, (unavailable): GateRun => {
      writeHookLog(
        context,
        target.harness,
        eventName,
        `the gate lock is unavailable: ${unavailable.reason}`,
      );

      return { kind: 'skipped' };
    })
    .exhaustive();
}

async function applyStep(request: StepRequest): Promise<GateRun> {
  const context = request.context;
  const gatePath = request.gatePath;
  const target = request.target;
  const event = request.event;

  if (context.fault === 'hold') {
    await holdLock(context);
  }

  const text = await readTextOrNull(gatePath);

  const parsed = text === null ? null : parseGateFile(text);

  if (text !== null && parsed === null && !request.isStart) {
    writeHookLog(
      context,
      target.harness,
      event.kind,
      'the gate file does not parse; the call runs',
    );

    return { kind: 'skipped' };
  }

  const step = stepGate(parsed, target.name, event, null);
  const line = step.file === null ? null : formatGateFile(step.file);

  if (line !== null) {
    writeFileAtomic(gatePath, line);
  }

  return { kind: 'ran', output: step.output, line };
}

// The fault `hold` keeps the lock until the file `hook-fault` is removed, so a proof can kill the
// process while it holds the lock. It writes `hook-held` first, so the proof knows the lock is taken.
async function holdLock(context: HookContext): Promise<void> {
  writeFileSync(join(context.root, 'hook-held'), '');

  while (existsSync(join(context.root, 'hook-fault'))) {
    await context.sleep(20);
  }
}
