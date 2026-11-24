// `ops_` and 5 characters: too short for the ops_ pattern of the credential test, built from parts
// so no commit holds a string that looks like a credential.
export function buildShortOpsValue(): string {
  return ['ops', '_abcde'].join('');
}
