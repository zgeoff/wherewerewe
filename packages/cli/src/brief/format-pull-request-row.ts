import { formatAge } from './format-age.ts';
import type { BriefInput } from './types.ts';

const maxRefCharacters = 60;

// `  <ref>  opened <age> ago  [<result>]`, with a ref over 60 characters cut to 59 and `…`.
export function formatPullRequestRow(
  pullRequest: BriefInput['pullRequests'][number],
  nowMs: number,
): string {
  const characters = Array.from(pullRequest.ref, (character) => character);
  const isCut = characters.length > maxRefCharacters;
  const ref = isCut ? `${characters.slice(0, maxRefCharacters - 1).join('')}…` : pullRequest.ref;

  return `  ${ref}  opened ${formatAge(nowMs - Date.parse(pullRequest.opened))} ago  [${pullRequest.result}]`;
}
