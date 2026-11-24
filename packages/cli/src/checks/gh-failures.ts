import type { UncheckedReason } from './types.ts';

// What `gh pr view` prints on stderr when it fails, mapped to what the probe reads. A probe keeps
// the reason and drops the text. Any other failure reads as offline.
export const ghFailures = {
  notFoundTexts: ['Could not resolve to a PullRequest', 'Could not resolve to a Repository'],
  notLoggedInTexts: ['gh auth login', 'HTTP 401'],
  offlineTexts: ['error connecting to', 'dial tcp', 'no such host', 'i/o timeout'],
  notLoggedInReason: 'gh not logged in',
  offlineReason: 'offline',
} as const satisfies Record<string, readonly string[] | UncheckedReason>;
