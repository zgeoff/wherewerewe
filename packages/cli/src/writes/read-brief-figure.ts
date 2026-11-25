import { buildReplyBriefInput } from '../brief/build-reply-brief-input.ts';
import { estimateTokens } from '../brief/estimate-tokens.ts';
import { pickBriefLimit } from '../brief/pick-brief-limit.ts';
import { renderBrief } from '../brief/render-brief.ts';
import type { BriefInput } from '../brief/types.ts';
import { readJournalIndex } from '../store/read-journal-index.ts';
import type { Store } from '../types.ts';
import type { BriefFigure } from './types.ts';

export interface BriefFigureContext {
  readonly nowMs: number;
  readonly sessionFlag: string | null;
  readonly host: 'claude' | 'codex' | null;
}

// The figure a write reply reports: the estimate of the brief rendered from the store as the write
// saved it, with each check's saved result and no probe, cut at the reader's host limit. The
// decisions in force come from the journal after the write's own row.
export async function readBriefFigure(
  folder: string,
  written: Store,
  context: BriefFigureContext,
): Promise<BriefFigure> {
  const journal = await readJournalIndex(folder);

  return buildBriefFigure(written, context, journal.inForce);
}

// The figure of a store with the decisions in force it is given, as a write reply reports it.
export function buildBriefFigure(
  written: Store,
  context: BriefFigureContext,
  decisions: BriefInput['decisions'],
): BriefFigure {
  const brief = renderBrief(buildReplyBriefInput(written, { ...context, decisions }));

  return { tokens: estimateTokens(brief), limit: pickBriefLimit(context.host).tokens };
}
