import { writeFile } from 'node:fs/promises';
import type { Gate } from './types.ts';

export async function writeGate(path: string, gate: Gate): Promise<void> {
  await writeFile(path, `state=${gate.state}\nrefusals=${gate.refusals}\n`);
}
