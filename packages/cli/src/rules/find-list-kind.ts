import { listKinds } from './list-kinds.ts';
import type { ListKind } from './list-kinds.ts';

// The kind `www list` takes that the text names, or null for any other text.
export function findListKind(text: string | undefined): ListKind | null {
  return listKinds.find((kind) => kind === text) ?? null;
}
