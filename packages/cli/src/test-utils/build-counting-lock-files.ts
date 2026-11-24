import type { LockFiles } from '../store/types.ts';

// Wraps the lock's file calls and counts the create calls. `onSecondCreate` runs just before the
// second one, so a test can free the lock only for an attempt that should never happen.
export function buildCountingLockFiles(
  files: LockFiles,
  onSecondCreate: () => void,
): { readonly files: LockFiles; readonly getCreateCount: () => number } {
  const state = { creates: 0 };

  return {
    files: {
      ...files,
      create: (path, content) => {
        state.creates += 1;

        if (state.creates === 2) {
          onSecondCreate();
        }

        return files.create(path, content);
      },
    },
    getCreateCount: () => state.creates,
  };
}
