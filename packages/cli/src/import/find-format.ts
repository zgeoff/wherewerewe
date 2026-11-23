import { stripCarriageReturn } from './strip-carriage-return.ts';

export function findFormat(sessionText: string): string | null {
  const values = sessionText
    .split('\n')
    .filter((line) => line.startsWith('format='))
    .map((line) => stripCarriageReturn(line.slice('format='.length)));

  return values.at(-1) ?? null;
}
