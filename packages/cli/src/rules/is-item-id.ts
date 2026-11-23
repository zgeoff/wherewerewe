// An item id is 2 to 16 of [a-z0-9-], starts with a letter, and is never d-<n> or o-<n>, which the
// tool keeps for decisions and owner notes.
export function isItemID(id: string): boolean {
  return /^[a-z][a-z0-9-]{1,15}$/u.test(id) && !/^[do]-[0-9]+$/u.test(id);
}
