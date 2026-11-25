import { isRecord } from '../hooks/is-record.ts';

// A TOML file as an object, with its comments, quoting and tables read as TOML reads them, or
// `null` when it is not TOML.
export function parseTOMLConfig(text: string): Readonly<Record<string, unknown>> | null {
  try {
    const value: unknown = Bun.TOML.parse(text);

    return isRecord(value) ? value : null;
  } catch {
    return null;
  }
}
