import type { ImportFiles } from '../store/types.ts';

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
    removeFile: (path) => {
      beforeCall();

      files.removeFile(path);
    },
    makeFolder: (path) => {
      beforeCall();

      files.makeFolder(path);
    },
    copyFile: (from, to) => {
      beforeCall();

      files.copyFile(from, to);
    },
    readMode: (path) => {
      beforeCall();

      return files.readMode(path);
    },
    writeFile: (path, text, mode) => {
      beforeCall();

      files.writeFile(path, text, mode);
    },
    rename: (from, to) => {
      beforeCall();

      files.rename(from, to);
    },
  };
}
