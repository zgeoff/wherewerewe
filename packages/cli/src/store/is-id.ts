const idPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/u;

export function isID(id: string): boolean {
  return idPattern.test(id);
}
