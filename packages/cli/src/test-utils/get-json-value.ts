// The value at a path of keys and indexes in a parsed JSON value, or null where the path leaves the
// value or ends on null.
export function getJsonValue(value: unknown, path: readonly (string | number)[]): unknown {
  return path.reduce<unknown>((found, step) => {
    if (typeof found !== 'object' || found === null) {
      return null;
    }

    const isMatch = Array.isArray(found) === (typeof step === 'number');

    return isMatch ? (Reflect.get(found, step) ?? null) : null;
  }, value);
}
