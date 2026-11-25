import type { Context } from '../types.ts';

export function stamp(context: Context): { by: string; at: string } {
  return { by: 'agent', at: new Date(context.now()).toISOString() };
}
