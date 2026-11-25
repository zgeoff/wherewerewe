import { readFile } from 'node:fs/promises';
import { isRecord } from '../utils/is-record.ts';
import type { Json, Step } from './types.ts';

export async function planJSON(path: string, change: (settings: Json) => Json): Promise<Step> {
  const text = await readFile(path, 'utf8').catch(() => null);

  try {
    const parsed: unknown = text === null || text.trim() === '' ? {} : JSON.parse(text);

    if (!isRecord(parsed)) {
      return { path, ok: false, detail: 'not JSON that www can read; left as it is' };
    }

    const content = `${JSON.stringify(change(parsed), null, 2)}\n`;

    const same =
      text !== null && JSON.stringify(JSON.parse(text)) === JSON.stringify(JSON.parse(content));

    return same
      ? { path, ok: true, detail: 'already set' }
      : { path, ok: false, detail: 'hook entries or allow rules missing', content };
  } catch {
    return { path, ok: false, detail: 'not JSON that www can read; left as it is' };
  }
}
