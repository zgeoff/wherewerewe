import { match } from 'ts-pattern';
import { gateTable } from './gate-table.ts';
import type { GateCell, GateColumn, GateEvent, GateFile, GateOutput, GateStep } from './types.ts';

// Applies one event of the main agent to the gate file. It reads no clock, file or environment.
// A payload of a subagent changes nothing; a file about another session is read as a fresh wipe
// and written back; `www` commands pass in every state; `reads` and `spare` follow their own rules.
export function stepGate(
  file: GateFile | null,
  bound: string,
  event: GateEvent,
  agentID: string | null,
): GateStep {
  const quiet: GateOutput = event.kind === 'call' ? { kind: 'pass' } : { kind: 'none' };

  if (agentID !== null) {
    return { file: null, output: quiet };
  }

  if (file === null) {
    const fresh: GateFile = { state: 'wiped', session: bound, reads: 0, spare: 1 };

    return event.kind === 'session-start'
      ? { file: fresh, output: { kind: 'inject' } }
      : { file: null, output: quiet };
  }

  const isOtherSession = file.session !== bound;

  const current: GateFile = isOtherSession
    ? { state: 'wiped', session: bound, reads: file.reads, spare: 1 }
    : file;

  if (event.kind === 'call' && event.call === 'www-command') {
    return { file: isOtherSession ? current : null, output: quiet };
  }

  const reads = countReads(current.reads, event);
  const cell = gateTable[current.state][findColumn(event)];
  const resolved = resolveCell(cell, { file: current, reads, event });

  const spare = match({ event, output: resolved.output })
    .with({ event: { kind: 'session-start' } }, () => 1 as const)
    .with({ output: { kind: 'refuse', reason: 'cut' } }, () => 0 as const)
    .otherwise(() => current.spare);

  const next: GateFile = { state: resolved.state, session: bound, reads, spare };
  const isSame = !isOtherSession && isSameFile(file, next);

  return { file: isSame ? null : next, output: resolved.output };
}

function countReads(reads: number, event: GateEvent): number {
  return match(event)
    .with({ kind: 'session-start' }, () => reads)
    .with({ kind: 'call', call: 'brief-command' }, () => reads + 1)
    .with({ kind: 'call' }, () => reads)
    .with({ kind: 'end' }, () => Math.max(reads - 1, 0))
    .with({ kind: 'stop' }, () => 0)
    .exhaustive();
}

function findColumn(event: GateEvent): GateColumn {
  return match(event)
    .with({ kind: 'session-start' }, (): GateColumn => 'session-start')
    .with({ kind: 'call', call: 'brief-command' }, (): GateColumn => 'brief-command')
    .with({ kind: 'call' }, (): GateColumn => 'other-call')
    .with({ kind: 'end' }, (ended): GateColumn => ended.end)
    .with({ kind: 'stop' }, (): GateColumn => 'stop')
    .exhaustive();
}

interface Situation {
  readonly file: GateFile;

  // the count after this event
  readonly reads: number;
  readonly event: GateEvent;
}

interface Resolved {
  readonly state: GateFile['state'];
  readonly output: GateOutput;
}

function resolveCell(cell: GateCell, situation: Situation): Resolved {
  return match(cell)
    .with({ kind: 'go' }, (go): Resolved => ({
      state: go.next === 'same' ? situation.file.state : go.next,
      output: toOutput(go),
    }))
    .with({ kind: 'when-reads-zero' }, (waiting): Resolved => ({
      state: situation.reads === 0 ? waiting.next : situation.file.state,
      output: { kind: 'none' },
    }))
    .with({ kind: 'by-spare' }, (bySpare) => {
      const chosen = situation.file.spare === 1 ? bySpare.spare1 : bySpare.spare0;

      return resolveCell(chosen, situation);
    })
    .with({ kind: 'by-stop-active' }, (byActive) => {
      const isActive = situation.event.kind === 'stop' && situation.event.stopHookActive;
      const chosen = isActive ? byActive.active : byActive.inactive;

      return resolveCell(chosen, situation);
    })
    .exhaustive();
}

function toOutput(cell: Extract<GateCell, { kind: 'go' }>): GateOutput {
  return match(cell.output)
    .with('refuse', (): GateOutput => ({ kind: 'refuse', reason: cell.reason ?? 'standard' }))
    .with('none', 'pass', 'pass-with-line', 'block', 'inject', (kind): GateOutput => ({ kind }))
    .exhaustive();
}

function isSameFile(left: GateFile, right: GateFile): boolean {
  return (
    left.state === right.state &&
    left.session === right.session &&
    left.reads === right.reads &&
    left.spare === right.spare
  );
}
