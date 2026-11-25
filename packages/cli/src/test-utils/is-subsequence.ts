// Whether every character of `part` appears in `whole` in the same order, so `whole` is `part`
// with text inserted and nothing removed or moved.
export function isSubsequence(part: string, whole: string): boolean {
  let at = 0;

  for (const char of whole) {
    at += char === part[at] ? 1 : 0;
  }

  return at === part.length;
}
