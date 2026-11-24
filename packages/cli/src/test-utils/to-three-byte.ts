// The text with each character but a space turned into `語`, which takes 3 bytes in UTF-8.
export function toThreeByte(text: string): string {
  return text.replaceAll(/[^ ]/gu, '語');
}
