import type { GateFile, GateState } from './types.ts';

// The gate file's one line, or null when it does not parse or lacks a field.
export function parseGateFile(text: string): GateFile | null {
  const groups =
    /^state=(?<state>[a-z]+) session=(?<session>\S+) reads=(?<reads>\d+) spare=(?<spare>[01])\n?$/u.exec(
      text,
    )?.groups;

  const state = groups?.['state'];
  const session = groups?.['session'];
  const reads = groups?.['reads'];
  const spare = groups?.['spare'];

  if (
    state === undefined ||
    session === undefined ||
    reads === undefined ||
    spare === undefined ||
    !isGateState(state)
  ) {
    return null;
  }

  return { state, session, reads: Number(reads), spare: spare === '1' ? 1 : 0 };
}

const states: readonly GateState[] = ['wiped', 'reading', 'cut', 'failed', 'read', 'open'];

function isGateState(value: string): value is GateState {
  return states.some((state) => state === value);
}
