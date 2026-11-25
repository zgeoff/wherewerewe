import { FFIType, dlopen } from 'bun:ffi';
import { closeSync, constants, openSync } from 'node:fs';

export type GateLockResult<Value> =
  | { readonly kind: 'ran'; readonly value: Value }
  | { readonly kind: 'busy' }
  | { readonly kind: 'unavailable'; readonly reason: string };

export interface GateLockOptions {
  readonly waitMs: number;

  // the awaitable wait between two tries, which tests drive
  readonly sleep: (delayMs: number) => Promise<void>;
}

const lockExclusive = 2;
const lockNoBlock = 4;
const pollMs = 10;

// An exclusive flock(2) on `<gate file>.lock`, a file of its own that no hook replaces: the gate
// file's rename gives its path a new file, and a lock on the old one would shut nobody out. The
// operating system releases the lock when the process exits, so a killed hook leaves none.
export async function withGateLock<Value>(
  gatePath: string,
  fn: () => Promise<Value>,
  options: GateLockOptions,
): Promise<GateLockResult<Value>> {
  const flock = loadFlock();

  if (typeof flock === 'string') {
    return { kind: 'unavailable', reason: flock };
  }

  const handle = openSync(
    `${gatePath}.lock`,
    constants.O_WRONLY | constants.O_APPEND | constants.O_CREAT | constants.O_NOFOLLOW,
    0o666,
  );

  try {
    const deadlineMs = performance.now() + options.waitMs;

    while (flock(handle, lockExclusive | lockNoBlock) !== 0) {
      if (performance.now() >= deadlineMs) {
        return { kind: 'busy' };
      }

      await options.sleep(pollMs);
    }

    return { kind: 'ran', value: await fn() };
  } finally {
    closeSync(handle);
  }
}

// The flock function of the C library, or the reason it cannot be loaded.
function loadFlock(): ((fd: number, operation: number) => number) | string {
  const name = process.platform === 'darwin' ? 'libSystem.B.dylib' : 'libc.so.6';

  try {
    const library = dlopen(name, {
      flock: { args: [FFIType.i32, FFIType.i32], returns: FFIType.i32 },
    });

    return (fd, operation) => library.symbols.flock(fd, operation);
  } catch (error) {
    return error instanceof Error ? error.message : 'dlopen failed';
  }
}
