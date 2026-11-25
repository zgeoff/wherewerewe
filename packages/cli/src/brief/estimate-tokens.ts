import { bytesPerToken } from './brief-limits.ts';

// The estimated tokens of a text: its UTF-8 bytes over 3, rounded up.
export function estimateTokens(text: string): number {
  return Math.ceil(Buffer.byteLength(text, 'utf8') / bytesPerToken);
}
