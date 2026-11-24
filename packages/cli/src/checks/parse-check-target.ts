import type { CheckRef } from '../types.ts';
import type { CheckTarget } from './types.ts';

// Splits a stored reference into the parts a probe passes as arguments. Null for text that no
// write stores.
export function parseCheckTarget(ref: CheckRef): CheckTarget | null {
  const split = ref.indexOf(':');
  const kind = ref.slice(0, split);
  const value = ref.slice(split + 1);

  if (kind === 'pr') {
    const hash = value.lastIndexOf('#');

    return hash < 1
      ? null
      : { kind: 'pr', repo: value.slice(0, hash), number: value.slice(hash + 1) };
  }

  if (kind === 'branch') {
    const at = value.lastIndexOf('@');

    return at < 1
      ? null
      : { kind: 'branch', repoPath: value.slice(0, at), name: value.slice(at + 1) };
  }

  if (kind === 'path') {
    return { kind: 'path', path: value };
  }

  if (kind === 'pid') {
    return { kind: 'pid', pid: Number(value) };
  }

  return null;
}
