import type { PromiseRow } from '../types.ts';
import { promisesHeader } from './constants.ts';

export function formatPromisesFile(promises: readonly PromiseRow[]): string {
  const rows = promises.map((promise) =>
    [promise.id, promise.what, promise.to, promise.byWhen, promise.written, promise.by].join('\t'),
  );

  return `${[promisesHeader, ...rows].join('\n')}\n`;
}
