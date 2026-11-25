import { closeSync, constants, openSync, writeSync } from 'node:fs';
import { open } from 'node:fs/promises';

const appendFlags =
  constants.O_WRONLY | constants.O_APPEND | constants.O_CREAT | constants.O_NOFOLLOW;

// Appends text to a file and refuses a link at its name with ELOOP, so a link an agent plants in the
// store never carries a row to a file outside it. A missing file is made with the mode `appendFile`
// gives one.
export function writeAppendNoFollow(path: string, text: string): void {
  const handle = openSync(path, appendFlags, 0o666);

  try {
    const bytes = Buffer.from(text);
    let written = 0;

    while (written < bytes.length) {
      written += writeSync(handle, bytes, written);
    }
  } finally {
    closeSync(handle);
  }
}

// The same append for a writer that awaits it.
export async function writeAppendNoFollowAsync(path: string, text: string): Promise<void> {
  const handle = await open(path, appendFlags, 0o666);

  try {
    await handle.appendFile(text);
  } finally {
    await handle.close();
  }
}
