import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Puts an executable shell script in a folder, to stand in for a command that a test finds through
// a PATH that holds only that folder. Returns the folder.
export function seedStubCommand(folder: string, name: string, script: string): string {
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, name), `#!/bin/sh\n${script}\n`);
  chmodSync(join(folder, name), 0o755);

  return folder;
}
