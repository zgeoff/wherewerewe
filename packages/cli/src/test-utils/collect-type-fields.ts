// The field names of each type and interface declared in TypeScript source, by the type's name.
// Comments and `readonly` do not count, and a nested object type adds its fields to its parent.
export function collectTypeFields(source: string): Record<string, string[]> {
  const code = source.replaceAll(/\/\/[^\n]*/gu, '');
  const starts = [...code.matchAll(/^(?:export )?(?:interface|type) (?<name>\w+)/gmu)];

  return Object.fromEntries(
    starts.map((start, index) => {
      const body = code.slice(start.index, starts[index + 1]?.index ?? code.length);

      const names = [...body.matchAll(/(?<name>\w+)\??:/gu)].flatMap(
        (found) => found.groups?.['name'] ?? [],
      );

      return [start.groups?.['name'] ?? '', [...new Set(names)].toSorted()];
    }),
  );
}
