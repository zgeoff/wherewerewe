import { join } from 'node:path';

export function findStoreRoot(env: Readonly<Record<string, string | undefined>>): string | null {
  const stateHome = env['XDG_STATE_HOME'];

  if (stateHome !== undefined && stateHome !== '') {
    return join(stateHome, 'wherewerewe');
  }

  const home = env['HOME'];

  return home !== undefined && home !== '' ? join(home, '.local', 'state', 'wherewerewe') : null;
}
