import { cpSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const fixtureFolder = join(import.meta.dir, 'fixtures', 'format-1-store');
const fixtureName = 'sample-store';

// Copies the invented format 1 store into a session folder of the given name, with the fixture's
// name replaced by the given one. Nothing in this slice writes format 1, so the commands cannot
// make this state. Returns the session folder.
export function seedFormat1Store(root: string, name: string): string {
  const folder = join(root, name);

  cpSync(fixtureFolder, folder, { recursive: true });

  for (const file of readdirSync(folder)) {
    const path = join(folder, file);

    writeFileSync(path, readFileSync(path, 'utf8').replaceAll(fixtureName, name));
  }

  return folder;
}
