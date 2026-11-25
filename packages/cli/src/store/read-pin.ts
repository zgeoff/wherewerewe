import { join } from 'node:path';
import { findTextProblem } from '../rules/find-text-problem.ts';
import { textLimits } from '../rules/text-limits.ts';
import { readTextOrNull } from './read-text-or-null.ts';

// The sentence of the `pin` file, or null when the file is missing, empty, unreadable, or holds
// more than one line or more than 200 characters. A pin that does not read is skipped, and never
// stops a read or a write.
export async function readPin(folder: string): Promise<string | null> {
  try {
    const file = await readTextOrNull(join(folder, 'pin'));

    const text = file?.replace(/\n$/u, '') ?? '';

    return findTextProblem(text, textLimits.pin) === null ? text : null;
  } catch {
    return null;
  }
}
