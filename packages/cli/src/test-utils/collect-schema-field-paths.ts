import { z } from 'zod';

// The path of each field a schema allows a value at: keys joined with dots, each array index as
// `[]`, and each branch of a discriminated union as `{<key>=<value>}`, so a field of one kind of row
// never stands for the same field of another. A field that is only ever null counts as a field.
export function collectSchemaFieldPaths(schema: z.core.$ZodType, path = ''): string[] {
  if (schema instanceof z.ZodNullable || schema instanceof z.ZodOptional) {
    return collectSchemaFieldPaths(schema.unwrap(), path);
  }

  if (schema instanceof z.ZodDiscriminatedUnion) {
    return schema.options.flatMap((option: z.core.$ZodType) =>
      collectSchemaFieldPaths(option, `${path}${getBranchTag(schema, option)}`),
    );
  }

  if (schema instanceof z.ZodUnion) {
    const paths = schema.options.flatMap((option: z.core.$ZodType) =>
      collectSchemaFieldPaths(option, path),
    );

    return [...new Set(paths)];
  }

  if (schema instanceof z.ZodObject) {
    return Object.entries(schema.shape).flatMap(([key, field]: [string, z.core.$ZodType]) =>
      collectSchemaFieldPaths(field, joinPath(path, key)),
    );
  }

  if (schema instanceof z.ZodArray) {
    return collectSchemaFieldPaths(schema.element, `${path}.[]`);
  }

  return [path];
}

function getBranchTag(union: z.ZodDiscriminatedUnion, option: z.core.$ZodType): string {
  const key = union.def.discriminator;
  const shape: Record<string, z.core.$ZodType> = option instanceof z.ZodObject ? option.shape : {};
  const field = shape[key];
  const values = field instanceof z.ZodLiteral ? [...field.values] : [];

  return `{${key}=${values.map(String).join('|')}}`;
}

function joinPath(path: string, key: string): string {
  return path === '' ? key : `${path}.${key}`;
}

// The paths, in the form above, of each field that holds a value in a value the schema parses. A
// missing field holds none, and nor does a null in a nullable one.
export function collectValueFieldPaths(
  schema: z.core.$ZodType,
  value: unknown,
  path = '',
): string[] {
  if (value === undefined) {
    return [];
  }

  if (schema instanceof z.ZodNullable || schema instanceof z.ZodOptional) {
    return value === null ? [] : collectValueFieldPaths(schema.unwrap(), value, path);
  }

  if (schema instanceof z.ZodDiscriminatedUnion) {
    const option = findBranch(schema, value);

    return option === undefined
      ? []
      : collectValueFieldPaths(option, value, `${path}${getBranchTag(schema, option)}`);
  }

  if (schema instanceof z.ZodUnion) {
    const option = schema.options.find(
      (candidate: z.core.$ZodType) => z.safeParse(candidate, value).success,
    );

    return option === undefined ? [] : collectValueFieldPaths(option, value, path);
  }

  if (schema instanceof z.ZodObject && typeof value === 'object' && value !== null) {
    const fields = new Map(Object.entries(value));

    return Object.entries(schema.shape).flatMap(([key, field]: [string, z.core.$ZodType]) =>
      collectValueFieldPaths(field, fields.get(key), joinPath(path, key)),
    );
  }

  if (schema instanceof z.ZodArray && Array.isArray(value)) {
    return value.flatMap((entry: unknown) =>
      collectValueFieldPaths(schema.element, entry, `${path}.[]`),
    );
  }

  return [path];
}

// The branch whose discriminator the value holds, so a row that lacks a field the branch requires
// still counts the fields it has.
function findBranch(union: z.ZodDiscriminatedUnion, value: unknown): z.core.$ZodType | undefined {
  const key = union.def.discriminator;

  const tag: unknown =
    typeof value === 'object' && value !== null
      ? new Map(Object.entries(value)).get(key)
      : undefined;

  return union.options.find((option: z.core.$ZodType) => {
    const shape: Record<string, z.core.$ZodType> =
      option instanceof z.ZodObject ? option.shape : {};

    const field = shape[key];

    return field instanceof z.ZodLiteral && [...field.values].some((literal) => literal === tag);
  });
}
