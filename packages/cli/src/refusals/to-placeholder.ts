import type { Placeholder } from '../types.ts';

export function toPlaceholder(text: string): Placeholder {
  return { placeholder: text };
}
