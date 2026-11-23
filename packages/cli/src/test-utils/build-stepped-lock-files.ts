import type { LockFiles } from '../store/types.ts';

// Wraps the lock's file calls so a test can run other writers between them: `onStep` runs before
// each call from number `fromStep` on, counting the calls from 0.
export function buildSteppedLockFiles(
  files: LockFiles,
  fromStep: number,
  onStep: () => void,
): LockFiles {
  const state = { step: 0 };

  const beforeCall = (): void => {
    if (state.step >= fromStep) {
      onStep();
    }

    state.step += 1;
  };

  return {
    create: (path, content) => {
      beforeCall();

      return files.create(path, content);
    },
    read: (path) => {
      beforeCall();

      return files.read(path);
    },
    remove: (path) => {
      beforeCall();

      files.remove(path);
    },
  };
}
