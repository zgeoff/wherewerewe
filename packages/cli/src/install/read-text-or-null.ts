import { readFileSync } from 'node:fs';

// Thrown when a file exists and cannot be read, so a caller never takes it for a missing file.
export class InstallReadError extends Error {
  public readonly path: string;

  public constructor(path: string, cause: unknown) {
    super(`cannot read ${path}`, { cause });

    this.name = 'InstallReadError';
    this.path = path;
  }
}

// The text of a file, or `null` when it does not exist. Any other failure, such as a file nobody
// may read or a folder in its place, throws an `InstallReadError`.
export function readTextOrNull(path: string): string | null {
  try {
    return readFileSync(path, 'utf8');
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return null;
    }

    throw new InstallReadError(path, error);
  }
}
