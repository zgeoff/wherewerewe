const namePattern = /^[a-z0-9][a-z0-9-]{0,39}$/u;

export function isName(name: string): boolean {
  return namePattern.test(name);
}
