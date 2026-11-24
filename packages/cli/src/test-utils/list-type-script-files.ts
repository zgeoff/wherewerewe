import { readdirSync } from 'node:fs';
import { join } from 'node:path';

// Every `.ts` file under each folder of the package, as a path from the package.
export function listTypeScriptFiles(packageDir: string, folders: readonly string[]): string[] {
  return folders.flatMap((folder) =>
    readdirSync(join(packageDir, folder), { recursive: true })
      .map(String)
      .filter((name) => name.endsWith('.ts'))
      .map((name) => join(folder, name)),
  );
}
