import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { match } from 'ts-pattern';
import { parseSessionFile } from '../store/parse-session-file.ts';
import type { SessionSummary } from '../types.ts';

// Lists each folder under the root that does not start with a dot, sorted by name, with what its
// `session` file says.
export async function readSessionSummaries(root: string): Promise<SessionSummary[]> {
  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);

  const names = entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
    .toSorted();

  return Promise.all(names.map((name) => readSummary(root, name)));
}

async function readSummary(root: string, name: string): Promise<SessionSummary> {
  const text = await readFile(join(root, name, 'session'), 'utf8').catch(() => null);

  const empty = { name, format: null, started: null, lastWrite: null, goal: null };

  if (text === null) {
    return empty;
  }

  const parsed = parseSessionFile(text);

  return match(parsed)
    .with({ kind: 'hand-kept' }, () => ({ ...empty, format: '0-by-hand' }))
    .with({ kind: 'newer' }, (newer) => ({ ...empty, format: newer.format }))
    .with({ kind: 'broken' }, () => empty)
    .with({ kind: 'session' }, (found) => ({
      name,
      format: found.session.format,
      started: found.session.started,
      lastWrite: found.session.lastWrite,
      goal: found.session.goal,
    }))
    .exhaustive();
}
