interface ChainTexts {
  readonly claim: string | null;
  readonly note: string | null;
}

// The line a write adds when its claim or its note chains three or more clauses with semicolons. It
// states a fact about the row, and the write goes ahead either way.
export function formatChainLine(id: string, texts: ChainTexts): string | null {
  const chained = (
    [
      ['claim', texts.claim],
      ['note', texts.note],
    ] as const
  )
    .filter(([, text]) => text !== null && text.split(';').length > 2)
    .map(([label]) => `the ${label}`);

  if (chained.length === 0) {
    return null;
  }

  const verb = chained.length === 1 ? 'chains' : 'chain';

  return `${id}: ${chained.join(' and ')} ${verb} clauses with semicolons, and a row holds one fact, so each clause fits a row of its own.`;
}
