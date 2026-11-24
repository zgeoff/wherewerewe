// Each pattern of the credential test, with the name a refusal prints for it. No name holds text
// that a pattern matches, so the output's redaction leaves each name in place.
export const credentialPatterns: readonly { readonly name: string; readonly pattern: RegExp }[] = [
  { name: 'ghp', pattern: /ghp_/u },
  { name: 'gho', pattern: /gho_/u },
  { name: 'ghs', pattern: /ghs_/u },
  { name: 'ghu', pattern: /ghu_/u },
  { name: 'github_pat', pattern: /github_pat_/u },
  { name: 'xoxb', pattern: /xoxb-/u },
  { name: 'xoxp', pattern: /xoxp-/u },
  { name: 'sk', pattern: /sk-[A-Za-z0-9]{20,}/u },
  { name: 'ghr', pattern: /ghr_/u },
  { name: 'xoxa', pattern: /xoxa-/u },
  { name: 'xoxr', pattern: /xoxr-/u },
  { name: 'xapp', pattern: /xapp-/u },
  { name: 'AKIA', pattern: /AKIA[A-Z0-9]{16}/u },
  { name: 'ops', pattern: /ops_\S{20,}/u },
  { name: 'BEGIN', pattern: /-----BEGIN/u },
  { name: 'eyJ', pattern: /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/u },
  { name: 'glpat', pattern: /glpat-[A-Za-z0-9_-]{20,}/u },
  { name: 'npm', pattern: /npm_[A-Za-z0-9_-]{20,}/u },
  { name: 'sk_live', pattern: /sk_live_[A-Za-z0-9_-]{20,}/u },
  { name: 'rk_live', pattern: /rk_live_[A-Za-z0-9_-]{20,}/u },
  { name: 'AIza', pattern: /AIza[A-Za-z0-9_-]{20,}/u },
];

// The name of the first pattern that matches, or null. A bare prefix such as ghp_ matches too:
// the design says the test matches at least its list.
export function findCredentialMatch(text: string): string | null {
  const match = credentialPatterns.find((entry) => entry.pattern.test(text));

  return match === undefined ? null : match.name;
}

export interface CredentialSpan {
  readonly start: number;

  // the index after the match's last character
  readonly end: number;
}

// The earliest place in the text that a pattern matches, or null exactly when no pattern does.
export function findCredentialSpan(text: string): CredentialSpan | null {
  return credentialPatterns.reduce<CredentialSpan | null>((first, entry) => {
    const found = entry.pattern.exec(text);

    if (found === null || (first !== null && first.start <= found.index)) {
      return first;
    }

    return { start: found.index, end: found.index + found[0].length };
  }, null);
}
