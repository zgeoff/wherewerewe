import type { Endpoints } from '@wringer/core';
import { WringerError } from '@wringer/core';

// The run's state folder, which the `local` target hands over as its `stateRoot` endpoint.
export function readStateRoot(endpoints: Endpoints): string {
  const stateRoot = endpoints['stateRoot'];

  if (stateRoot === undefined) {
    throw new WringerError('not-running', {
      message: 'The run has no stateRoot endpoint.',
      hint: 'Run `bun verify up --restart`, then `bun verify doctor`.',
    });
  }

  return stateRoot;
}
