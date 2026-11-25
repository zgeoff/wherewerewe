import { isRecord } from '../hooks/is-record.ts';

export type SettingsRead =
  | { readonly kind: 'blank' }
  | { readonly kind: 'object'; readonly value: Readonly<Record<string, unknown>> }
  | { readonly kind: 'unreadable' };

// A settings file as strict JSON: a file of nothing but white space is blank, and one that is not
// JSON, such as one with a comment or a trailing comma, or whose top level is not an object, is
// unreadable.
export function parseJSONSettings(text: string): SettingsRead {
  if (text.trim() === '') {
    return { kind: 'blank' };
  }

  try {
    const value: unknown = JSON.parse(text);

    return isRecord(value) ? { kind: 'object', value } : { kind: 'unreadable' };
  } catch {
    return { kind: 'unreadable' };
  }
}
