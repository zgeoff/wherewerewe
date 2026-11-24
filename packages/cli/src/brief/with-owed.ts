// The tag with `· owed` after it when the item has an owed note.
export function withOwed(tag: string, isOwed: boolean): string {
  return isOwed ? `${tag} · owed` : tag;
}
