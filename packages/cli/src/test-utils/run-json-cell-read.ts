import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { runCLI } from '../run-cli.ts';
import type { CLIResult } from '../types.ts';
import { seedJsonCellsStore } from './seed-json-cells-store.ts';

// Seeds a store of its own under `parent`, with the cells given over the plain ones, and reads it
// with `argv --json` at 2026-03-10T11:43:00Z as an agent bound to the session.
export function runJsonCellRead(
  parent: string,
  cells: Readonly<Record<string, string>>,
  argv: readonly string[],
): Promise<CLIResult> {
  const root = mkdtempSync(join(parent, 'cells-'));

  seedJsonCellsStore(root, cells);

  return runCLI({
    argv: [...argv, '--json'],
    env: {
      HOME: root,
      XDG_STATE_HOME: root,
      CLAUDE_CODE_SESSION_ID: '',
      WHEREWEREWE_SESSION: cells['session name'] ?? 'tide-alerts',
    },
    cwd: '/work',
    terminal: { stdin: false, stdout: false },
    now: () => Date.parse('2026-03-10T11:43:00Z'),
  });
}
