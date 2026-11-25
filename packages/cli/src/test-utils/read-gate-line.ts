import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// The text of the gate file of an agent session, or null when it has none.
export function readGateLine(root: string, harnessAndID: string): string | null {
  try {
    return readFileSync(join(root, '.gate', harnessAndID), 'utf8').trim();
  } catch {
    return null;
  }
}
