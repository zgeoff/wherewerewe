import { z } from 'zod';

// The path of each free string a schema allows, in the form collect-string-leaves.ts gives a parsed
// value's strings: keys joined with dots and each array index as `[]`. An enum or a literal is
// not free text, so it has no path here.
export function collectSchemaStringPaths(
  schema: z.core.$ZodType,
  path: readonly string[] = [],
): string[] {
  if (schema instanceof z.ZodString) {
    return [path.join('.')];
  }

  if (schema instanceof z.ZodObject) {
    return Object.entries(schema.shape).flatMap(([key, field]: [string, z.core.$ZodType]) =>
      collectSchemaStringPaths(field, [...path, key]),
    );
  }

  if (schema instanceof z.ZodArray) {
    return collectSchemaStringPaths(schema.element, [...path, '[]']);
  }

  if (schema instanceof z.ZodNullable || schema instanceof z.ZodOptional) {
    return collectSchemaStringPaths(schema.unwrap(), path);
  }

  if (schema instanceof z.ZodUnion) {
    return [
      ...new Set(
        schema.options.flatMap((option: z.core.$ZodType) => collectSchemaStringPaths(option, path)),
      ),
    ];
  }

  return [];
}
