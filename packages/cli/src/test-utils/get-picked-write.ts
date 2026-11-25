import type { StoreChange } from '../types.ts';
import type { WriteResult } from '../writes/types.ts';

export function getPickedWrite(
  picked: WriteResult,
  briefTokens: number,
): { readonly change: StoreChange; readonly reply: string } {
  if (picked.kind === 'refused') {
    throw new Error(`the write was refused: ${picked.refusal.lines.join(' ')}`);
  }

  return { change: picked.change, reply: picked.reply({ tokens: briefTokens, limit: 8000 }) };
}
