// An item id is 2 to 16 of [a-z0-9-], starts with a letter, and is never grant, d-<n> or o-<n>: the
// tool keeps grant for the grant, d-<n> for decisions and o-<n> for owner notes.
export function isItemID(id: string): boolean {
  return /^[a-z][a-z0-9-]{1,15}$/u.test(id) && id !== 'grant' && !/^[do]-[0-9]+$/u.test(id);
}
