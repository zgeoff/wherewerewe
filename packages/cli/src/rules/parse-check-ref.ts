import type { CheckRef } from '../types.ts';

// The stored form of a check: pr:<owner>/<repo>#<n>, branch:<absolute path>@<branch>,
// path:<absolute path> or pid:<n>. Null when the text is none of them.
export function parseCheckRef(text: string): CheckRef | null {
  const split = text.indexOf(':');
  const kind = text.slice(0, split);
  const value = text.slice(split + 1);

  if (split < 1 || /[\t\n\r]/u.test(value)) {
    return null;
  }

  const isValid =
    (kind === 'pr' && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+#[1-9][0-9]*$/u.test(value)) ||
    (kind === 'pid' && /^[1-9][0-9]*$/u.test(value)) ||
    (kind === 'path' && value.startsWith('/')) ||
    (kind === 'branch' && isBranchValue(value));

  return isValid ? text : null;
}

function isBranchValue(value: string): boolean {
  const split = value.lastIndexOf('@');
  const branch = value.slice(split + 1);

  return split > 0 && value.startsWith('/') && branch !== '' && !/\s/u.test(branch);
}
