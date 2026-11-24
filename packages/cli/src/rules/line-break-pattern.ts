// A tab or any line break: a line feed, a carriage return, a vertical tab, a form feed, a next-line
// character, or a Unicode line or paragraph separator. No cell or `session` value holds one.
export const lineBreakPattern = /[\t\n\v\f\r\u0085\u2028\u2029]/u;
