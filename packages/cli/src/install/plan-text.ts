import { readFile } from 'node:fs/promises';
import type { Step } from './types.ts';

export async function planText(
  path: string,
  content: string,
  mayReplace: (text: string) => boolean,
): Promise<Step> {
  const text = await readFile(path, 'utf8').catch(() => null);

  if (text === content) {
    return { path, ok: true, detail: 'already set' };
  }

  if (text !== null && !mayReplace(text)) {
    return { path, ok: false, detail: 'a file www did not write; left as it is' };
  }

  return { path, ok: false, detail: text === null ? 'missing' : 'from another version', content };
}
