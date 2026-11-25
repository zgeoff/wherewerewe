import { renderGrantBullets } from '../brief/render-grant-bullets.ts';
import { redactCredentialWords } from '../rules/redact-credential-words.ts';
import type { Grant } from '../types.ts';

// The /goal text of a grant for the owner to paste: the bullets under may, not and never as the
// brief prints them, the scope when the grant has one, and a line that names the session. It holds
// no reading and no goal. Each bullet and the scope pass the credential redaction first.
export function renderGoalPaste(grant: Grant, name: string): string {
  const bullets = renderGrantBullets({
    may: grant.may.map((bullet) => redactCredentialWords(bullet)),
    not: grant.not.map((bullet) => redactCredentialWords(bullet)),
    never: grant.never.map((bullet) => redactCredentialWords(bullet)),
    scope: null,
  });

  const scope = grant.scope === null ? [] : [`  scope  ${redactCredentialWords(grant.scope)}`];

  return [...bullets, ...scope, `Run www --session ${name} and deliver all the work in it.`]
    .map((line) => `${line}\n`)
    .join('');
}
