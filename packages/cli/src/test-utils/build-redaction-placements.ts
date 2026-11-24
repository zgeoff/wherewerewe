export interface RedactionPlacement {
  readonly name: string;

  // a stored value that holds the sample
  readonly build: (sample: string) => string;
}

// The three places a credential sits in a stored value: at its start, across the column where a
// wrap or a cut would split it, and at its end before a space or a closing bracket.
export function buildRedactionPlacements(): RedactionPlacement[] {
  return [
    { name: 'at the start', build: (sample) => `${sample} then plain words` },
    { name: 'across the wrap', build: (sample) => `${'a '.repeat(46)}${sample} end` },
    { name: 'at the end', build: (sample) => `see the vault (${sample}) ` },
  ];
}
