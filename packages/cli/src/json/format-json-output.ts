import { redactCredentialWords } from '../rules/redact-credential-words.ts';

// The value as one line of JSON and a newline. Each string, an object key included, passes the
// credential redaction before it is encoded, so the line always parses.
export function formatJSONOutput(value: unknown): string {
  return `${JSON.stringify(redactValue(value))}\n`;
}

function redactValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return redactCredentialWords(value);
  }

  if (Array.isArray(value)) {
    return value.map((entry: unknown) => redactValue(entry));
  }

  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [redactCredentialWords(key), redactValue(entry)]),
    );
  }

  return value;
}
