import type { ImportFiles } from '../store/types.ts';

// Wraps the import's file calls so a test can stop it between any two: `onStep` runs before each
// call from number `fromStep` on, counting the calls from 0.
export function buildSteppedImportFiles(
  files: ImportFiles,
  fromStep: number,
  onStep: () => void,
): ImportFiles {
  const state = { step: 0 };

  const beforeCall = (): void => {
    if (state.step >= fromStep) {
      onStep();
    }

    state.step += 1;
  };

  return {
    exists: (path) => {
      beforeCall();

      return files.exists(path);
    },
    list: (path) => {
      beforeCall();

      return files.list(path);
    },
    removeFolder: (path) => {
      beforeCall();

      files.removeFolder(path);
    },
    makeFolder: (path) => {
      beforeCall();

      files.makeFolder(path);
    },
    copyFile: (from, to) => {
      beforeCall();

      files.copyFile(from, to);
    },
    writeFile: (path, text) => {
      beforeCall();

      files.writeFile(path, text);
    },
    rename: (from, to) => {
      beforeCall();

      files.rename(from, to);
    },
  };
}
