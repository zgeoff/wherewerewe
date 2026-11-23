import { buildBriefInput } from '../brief/build-brief-input.ts';
import { renderBrief } from '../brief/render-brief.ts';
import { buildRefusal } from '../refusals/build-refusal.ts';
import { readJournalIndex } from '../store/read-journal-index.ts';
import { readStore } from '../store/read-store.ts';
import { withStoreLock } from '../store/with-store-lock.ts';
import { writeStoreFiles } from '../store/write-store-files.ts';
import type { ParsedArgs, Refusal } from '../types.ts';
import type { WriteInput, WriteResult } from './types.ts';

export type RunWriteResult =
  | { readonly kind: 'replied'; readonly reply: string }
  | { readonly kind: 'refused'; readonly refusal: Refusal };

export interface WriteRequest {
  readonly folder: string;
  readonly name: string;
  readonly args: ParsedArgs;
  readonly cwd: string;
  readonly nowMs: number;
  readonly pick: (input: WriteInput) => WriteResult;
}

// The thin locked write: inside the lock it reads the store and the journal index, asks the pure
// function what to do, writes it, and counts the lines of the brief as written.
export async function runWrite(input: WriteRequest): Promise<RunWriteResult> {
  const locked = await withStoreLock(
    input.folder,
    async (): Promise<RunWriteResult> => {
      const read = await readStore(input.folder);

      if (read.kind !== 'store') {
        throw new Error(`the store of ${input.name} changed under a write: ${read.kind}`);
      }

      const picked = input.pick({
        store: read.store,
        journal: await readJournalIndex(input.folder),
        args: input.args,
        cwd: input.cwd,
        nowMs: input.nowMs,
      });

      if (picked.kind === 'refused') {
        return { kind: 'refused', refusal: picked.refusal };
      }

      await writeStoreFiles(input.folder, picked.change);

      const written = {
        ...read.store,
        session: picked.change.session ?? read.store.session,
        items: picked.change.items ?? read.store.items,
      };

      const briefLines = renderBrief(buildBriefInput(written, input.nowMs)).split('\n').length - 1;

      return { kind: 'replied', reply: picked.reply(briefLines) };
    },
    { waitMs: 2000 },
  );

  if (locked.kind === 'busy') {
    return {
      kind: 'refused',
      refusal: buildRefusal({
        kind: 'lock-busy',
        args: input.args,
        name: input.name,
        pid: locked.pid,
      }),
    };
  }

  return locked.value;
}
