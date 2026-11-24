export interface CredentialSample {
  // the name of the pattern the sample matches first
  readonly name: string;
  readonly sample: string;

  // the part after the pattern's prefix, which no output may hold either
  readonly tail: string;
}

// One sample for each pattern of the credential test, each built from parts so no commit holds a
// credential. The ops_ sample holds a semicolon, a character that ends a word for the redaction.
export function buildCredentialSamples(): CredentialSample[] {
  const tail = ['Qz7Wx', '9Lm2N', 'p4Rt6', 'Vy8Bc'].join('');

  return [
    ...['ghp', 'gho', 'ghs', 'ghu', 'ghr', 'github_pat', 'npm'].map((name) =>
      prefixed(name, [name, '_'].join(''), tail),
    ),
    ...['xoxb', 'xoxp', 'xoxa', 'xoxr', 'xapp', 'sk', 'glpat'].map((name) =>
      prefixed(name, [name, '-'].join(''), tail),
    ),
    prefixed('sk_live', ['sk', '_live_'].join(''), tail),
    prefixed('rk_live', ['rk', '_live_'].join(''), tail),
    prefixed('AIza', ['AI', 'za'].join(''), tail),
    prefixed('AKIA', ['AK', 'IA'].join(''), tail.toUpperCase().slice(0, 16)),
    prefixed('ops', ['ops', '_'].join(''), [tail.slice(0, 10), ';', tail.slice(10)].join('')),
    prefixed('BEGIN', ['-----', 'BEGIN'].join(''), tail),
    prefixed(
      'eyJ',
      ['ey', 'J'].join(''),
      [tail.slice(0, 6), tail.slice(6, 12), tail.slice(12)].join('.'),
    ),
  ];
}

function prefixed(name: string, prefix: string, rest: string): CredentialSample {
  return { name, sample: [prefix, rest].join(''), tail: rest };
}
