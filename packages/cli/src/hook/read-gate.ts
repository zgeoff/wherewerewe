import { readFile } from 'node:fs/promises';
import type { Gate } from './types.ts';

export async function readGate(path: string): Promise<Gate> {
  const text = await readFile(path, 'utf8').catch(() => '');

  const state = /^state=(?<state>wiped|read)$/mu.exec(text)?.groups?.['state'];
  const refusals = Number(/^refusals=(?<count>\d+)$/mu.exec(text)?.groups?.['count'] ?? '0');

  return { state: state === 'wiped' ? 'wiped' : 'read', refusals };
}
