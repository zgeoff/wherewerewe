import type { OwnerFiles } from '../store/types.ts';

export function buildSteppedOwnerFiles(
  files: OwnerFiles,
  fromStep: number,
  onStep: () => void,
): OwnerFiles {
  const state = { step: 0 };

  const beforeCall = (): void => {
    if (state.step >= fromStep) {
      onStep();
    }

    state.step += 1;
  };

  return {
    append: (path, text) => {
      beforeCall();

      files.append(path, text);
    },
    writeTemporary: (path, text) => {
      beforeCall();

      return files.writeTemporary(path, text);
    },
    rename: (from, to) => {
      beforeCall();

      files.rename(from, to);
    },
  };
}
