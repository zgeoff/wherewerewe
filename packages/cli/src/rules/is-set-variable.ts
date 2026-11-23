export function isSetVariable(value: string | undefined): value is string {
  return value !== undefined && value !== '';
}
