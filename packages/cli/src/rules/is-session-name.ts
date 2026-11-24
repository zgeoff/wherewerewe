import { textLimits } from './text-limits.ts';

export function isSessionName(name: string): boolean {
  return new RegExp(
    `^[a-z][a-z0-9-]{${String(textLimits.sessionNameMin - 1)},${String(textLimits.sessionNameMax - 1)}}$`,
    'u',
  ).test(name);
}
