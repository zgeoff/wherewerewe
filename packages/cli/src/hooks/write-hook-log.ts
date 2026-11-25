import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { formatTimestamp } from '../format-timestamp.ts';
import { writeAppendNoFollow } from '../store/write-append-no-follow.ts';
import { writeFileAtomic } from '../store/write-file-atomic.ts';

const keptLines = 200;

interface HookLogContext {
  readonly root: string;
  readonly now: () => number;
}

// Appends one line to `hook-errors.log` in the store root and keeps the last 200 lines. It never
// throws: a hook that cannot log still lets its call run.
export function writeHookLog(
  context: HookLogContext,
  harness: string,
  event: string,
  message: string,
): void {
  const path = join(context.root, 'hook-errors.log');
  const line = `${formatTimestamp(context.now())} ${harness} ${event} ${message.replaceAll('\n', ' ')}\n`;

  try {
    writeAppendNoFollow(path, line);

    const lines = readFileSync(path, 'utf8')
      .split('\n')
      .filter((kept) => kept !== '');

    if (lines.length > keptLines) {
      writeFileAtomic(path, `${lines.slice(-keptLines).join('\n')}\n`);
    }
  } catch {
    // an unwritable log leaves the hook nothing to report to
  }
}
