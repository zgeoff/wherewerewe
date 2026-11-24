import { buildReplyBriefInput } from '../brief/build-reply-brief-input.ts';
import { renderBrief } from '../brief/render-brief.ts';
import { readJournalIndex } from '../store/read-journal-index.ts';
import { readStore } from '../store/read-store.ts';

export interface SavedBriefContext {
  readonly nowMs: number;
  readonly sessionFlag: string | null;
  readonly host: 'claude' | 'codex' | null;
}

// The brief rendered from the store as it now sits on disk, with each check's saved result and no
// probe, at the host's limit: what a write reply's estimate counts. It reads the store and the
// journal afresh, so it shares no value with the write that ran before it.
export async function readSavedBrief(folder: string, context: SavedBriefContext): Promise<string> {
  const read = await readStore(folder);
  const journal = await readJournalIndex(folder);

  if (read.kind !== 'store') {
    throw new Error(`no store to render in ${folder}`);
  }

  return renderBrief(buildReplyBriefInput(read.store, { ...context, decisions: journal.inForce }));
}
