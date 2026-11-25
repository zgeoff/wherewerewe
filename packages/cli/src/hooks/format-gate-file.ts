import type { GateFile } from './types.ts';

export function formatGateFile(file: GateFile): string {
  return `state=${file.state} session=${file.session} reads=${String(file.reads)} spare=${String(file.spare)}\n`;
}
