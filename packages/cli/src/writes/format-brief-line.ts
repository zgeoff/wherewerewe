import type { BriefFigure } from './types.ts';

// `Brief: <t> of <limit> tokens.`, which ends every write reply but the session commands'.
export function formatBriefLine(figure: BriefFigure): string {
  return `Brief: ${String(figure.tokens)} of ${String(figure.limit)} tokens.`;
}
