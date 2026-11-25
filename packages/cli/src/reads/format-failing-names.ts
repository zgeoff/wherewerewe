import { redactJoinedCredentials } from '../rules/redact-joined-credentials.ts';

// Characters that print as a space or as nothing. The names come from outside the store, so each
// credential that such a character splits is redacted on the raw name, before the characters
// become spaces. The line then passes the redaction and the 100 character cut again.
const outsideSeparator = /[\s\p{Cc}\p{Cf}]/u;

// The names of the failing checks as show prints them. A name that is empty once cleaned is left
// out.
export function formatFailingNames(failing: readonly string[]): string[] {
  return failing
    .map((name) =>
      redactJoinedCredentials(name, outsideSeparator)
        .replaceAll(/[\s\p{Cc}\p{Cf}]/gu, ' ')
        .trim(),
    )
    .filter((name) => name !== '');
}
