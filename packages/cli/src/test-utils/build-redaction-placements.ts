export interface RedactionPlacement {
  readonly name: string;

  // a stored value that holds the sample
  readonly build: (sample: string) => string;
}

// The three places a credential sits in a stored value: at its start, across every column from 85 to
// 100 where a wrap or a cut would split it, and at its end before a space or a closing bracket. Each
// value stays within the 120 characters of a lesson or a promise, even holding the longest sample.
export function buildRedactionPlacements(): RedactionPlacement[] {
  return [
    { name: 'at the start', build: (sample) => `${sample} then plain words` },
    { name: 'across the wrap', build: (sample) => `${'a '.repeat(40)}${sample} end` },
    { name: 'at the end', build: (sample) => `see the vault (${sample}) ` },
  ];
}

// A decision's choice cuts at 199 characters in the brief, so its sample starts at column 190. A
// journal row holds more than a lesson's 120 characters, so only a decision takes this value.
export function buildCutPlacement(sample: string): string {
  return `${'a '.repeat(95)}${sample} end`;
}
