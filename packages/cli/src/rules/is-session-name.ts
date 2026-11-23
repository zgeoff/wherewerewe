export function isSessionName(name: string): boolean {
  return /^[a-z][a-z0-9-]{1,23}$/u.test(name);
}
