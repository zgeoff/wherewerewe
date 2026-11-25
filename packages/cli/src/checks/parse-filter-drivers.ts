import { match } from 'ts-pattern';
import type { CommandResult } from './types.ts';

// names: the drivers a config other than the owner's global or system one defines, sorted
export type FilterDrivers =
  | { readonly kind: 'drivers'; readonly names: readonly string[] }
  | { readonly kind: 'git missing' }
  | { readonly kind: 'unreadable' };

// The filter drivers of `git config --show-scope --name-only --get-regexp` for the clean, smudge
// and process keys. Exit 1 lists no key. Any other failure, and a name that could reach git's -c
// as more than a driver name, reads as unreadable.
export function parseFilterDrivers(command: CommandResult): FilterDrivers {
  return match(command)
    .with({ kind: 'missing' }, (): FilterDrivers => ({ kind: 'git missing' }))
    .with({ kind: 'timeout' }, (): FilterDrivers => ({ kind: 'unreadable' }))
    .with({ kind: 'exit' }, (exit) => parseListing(exit.code, exit.stdout))
    .exhaustive();
}

const ownerScopes: ReadonlySet<string> = new Set(['global', 'system']);

function parseListing(code: number, stdout: string): FilterDrivers {
  if (code === 1 && stdout === '') {
    return { kind: 'drivers', names: [] };
  }

  if (code !== 0) {
    return { kind: 'unreadable' };
  }

  const keys = stdout
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => /^(?<scope>[a-z]+)\tfilter\.(?<name>.+)\.(?:clean|smudge|process)$/u.exec(line));

  const names = keys.flatMap((key) => {
    const scope = key?.groups?.['scope'] ?? '';

    return ownerScopes.has(scope) ? [] : [key?.groups?.['name'] ?? ''];
  });

  if (keys.includes(null) || names.some((name) => !/^[A-Za-z0-9._-]+$/u.test(name))) {
    return { kind: 'unreadable' };
  }

  return { kind: 'drivers', names: [...new Set(names)].toSorted() };
}
