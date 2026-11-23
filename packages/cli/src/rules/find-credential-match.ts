const credentialPatterns: readonly { readonly label: string; readonly pattern: RegExp }[] = [
  { label: 'ghp_', pattern: /ghp_/u },
  { label: 'gho_', pattern: /gho_/u },
  { label: 'ghs_', pattern: /ghs_/u },
  { label: 'ghu_', pattern: /ghu_/u },
  { label: 'github_pat_', pattern: /github_pat_/u },
  { label: 'xoxb-', pattern: /xoxb-/u },
  { label: 'xoxp-', pattern: /xoxp-/u },
  { label: 'sk-', pattern: /sk-[A-Za-z0-9]{20,}/u },
  { label: 'ghr_', pattern: /ghr_/u },
  { label: 'xoxa-', pattern: /xoxa-/u },
  { label: 'xoxr-', pattern: /xoxr-/u },
  { label: 'xapp-', pattern: /xapp-/u },
  { label: 'AKIA', pattern: /AKIA[A-Z0-9]{16}/u },
  { label: 'ops_', pattern: /ops_\S{20,}/u },
  { label: '-----BEGIN', pattern: /-----BEGIN/u },
  { label: 'eyJ', pattern: /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/u },
  { label: 'glpat-', pattern: /glpat-[A-Za-z0-9_-]{20,}/u },
  { label: 'npm_', pattern: /npm_[A-Za-z0-9_-]{20,}/u },
  { label: 'sk_live_', pattern: /sk_live_[A-Za-z0-9_-]{20,}/u },
  { label: 'rk_live_', pattern: /rk_live_[A-Za-z0-9_-]{20,}/u },
  { label: 'AIza', pattern: /AIza[A-Za-z0-9_-]{20,}/u },
];

// The label of the first pattern that matches, or null. A bare prefix such as ghp_ matches too:
// the design says the test matches at least its list.
export function findCredentialMatch(text: string): string | null {
  const match = credentialPatterns.find((entry) => entry.pattern.test(text));

  return match === undefined ? null : match.label;
}
