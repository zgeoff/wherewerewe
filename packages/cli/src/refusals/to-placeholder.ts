import type { Placeholder, PlaceholderShape } from '../types.ts';

export function toPlaceholder(text: string, shape?: PlaceholderShape): Placeholder {
  return shape === undefined ? { placeholder: text } : { placeholder: text, shape };
}
