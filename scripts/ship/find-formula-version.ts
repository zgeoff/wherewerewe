// The version a formula's text declares, or null when it declares none.
export function findFormulaVersion(formula: string): string | null {
  return /^\s*version "(?<version>[^"]+)"/mu.exec(formula)?.groups?.['version'] ?? null;
}
