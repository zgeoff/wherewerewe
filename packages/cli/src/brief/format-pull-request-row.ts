import { redactCredential } from '../rules/redact-credential.ts';
import { formatAge } from './format-age.ts';
import type { BriefInput } from './types.ts';

export const briefRefCharacters = 60;

// `  <ref>  opened <age> ago  [<result>]`. The ref is redacted whole, then cut to `maxRefCharacters`
// characters, the last of them `…`, when it is longer.
export function formatPullRequestRow(
  pullRequest: BriefInput['pullRequests'][number],
  nowMs: number,
  maxRefCharacters: number,
): string {
  const redacted = redactCredential(pullRequest.ref);
  const characters = Array.from(redacted, (character) => character);

  const ref =
    characters.length > maxRefCharacters
      ? `${characters.slice(0, maxRefCharacters - 1).join('')}…`
      : redacted;

  return `  ${ref}  opened ${formatAge(nowMs - Date.parse(pullRequest.opened))} ago  [${pullRequest.result}]`;
}
