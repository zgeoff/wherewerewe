import { InstallReadError, readTextOrNull } from './read-text-or-null.ts';

// The text of a file for a doctor check. A file that cannot be read counts as missing, so the check
// fails and names it; doctor never fixes or prints it.
export function readDoctorText(path: string): string | null {
  try {
    return readTextOrNull(path);
  } catch (error) {
    if (error instanceof InstallReadError) {
      return null;
    }

    throw error;
  }
}
