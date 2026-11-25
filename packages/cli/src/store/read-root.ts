import { join } from 'node:path';
import type { Env } from '../types.ts';

// The folder that holds every session on this machine.
export function readRoot(env: Env): string {
  const state = env['XDG_STATE_HOME'] ?? join(env['HOME'] ?? '.', '.local', 'state');

  return join(state, 'wherewerewe');
}
