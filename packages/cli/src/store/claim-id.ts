import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Row } from '../types.ts';
import { nextID } from './next-id.ts';

const tries = 200;

interface Session {
  readonly root: string;
  readonly name: string;
}

// The id of a new row: the one the agent gave, or the next free one for the label, such as wait-3.
// An empty file in .ids/ marks a made id as taken, so two writers at once get two ids. When the
// folder cannot be written, the id is still returned.
export async function claimID(
  session: Session,
  lines: readonly Row[],
  label: string,
  given: string | undefined,
): Promise<string> {
  if (given !== undefined) {
    return given;
  }

  const folder = join(session.root, session.name, '.ids');
  const first = nextID(lines, label);
  const start = Number(first.slice(label.length + 1));

  await mkdir(folder, { recursive: true }).catch(() => null);

  for (let count = start; count < start + tries; count += 1) {
    const id = `${label}-${count}`;

    const outcome = await writeFile(join(folder, id), '', { flag: 'wx' }).then(
      () => 'taken',
      (error: unknown) => (error instanceof Error && 'code' in error ? error.code : 'failed'),
    );

    if (outcome !== 'EEXIST') {
      return id;
    }
  }

  return first;
}
