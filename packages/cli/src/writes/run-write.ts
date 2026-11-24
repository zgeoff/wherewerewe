import { match } from 'ts-pattern';
import { buildReplyBriefInput } from '../brief/build-reply-brief-input.ts';
import { renderBrief } from '../brief/render-brief.ts';
import { buildReadRefusal } from '../refusals/build-read-refusal.ts';
import { buildRefusal } from '../refusals/build-refusal.ts';
import { readJournalIndex } from '../store/read-journal-index.ts';
import { readStore } from '../store/read-store.ts';
import { withStoreLock } from '../store/with-store-lock.ts';
import { writeStoreFiles } from '../store/write-store-files.ts';
import type { ParsedArgs, Refusal, Store } from '../types.ts';
import { runWriteProbe } from './run-write-probe.ts';
import type { WriteInput, WriteProbe, WriteResult } from './types.ts';

export type RunWriteResult =
  | { readonly kind: 'replied'; readonly reply: string }
  | { readonly kind: 'refused'; readonly refusal: Refusal };

export interface WriteRequest {
  readonly folder: string;
  readonly name: string;
  readonly args: ParsedArgs;
  readonly cwd: string;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly nowMs: number;

  // the agent that runs the write, which sets the budget of the brief it counts
  readonly host: 'claude' | 'codex' | null;
  readonly pick: (input: WriteInput) => WriteResult;
}

// The thin locked write: before the lock it probes the check the write stores; inside the lock it
// reads the store and the journal index, asks the pure function what to do, writes it, and counts
// the lines of the brief as written.
export async function runWrite(input: WriteRequest): Promise<RunWriteResult> {
  const probed = await runWriteProbe(input);

  const locked = await withStoreLock(
    input.folder,
    async (): Promise<RunWriteResult> => {
      const read = await readStore(input.folder);

      return match(read)
        .with({ kind: 'store' }, (found) => writeOnce(input, found.store, probed))
        .with(
          { kind: 'hand-kept' },
          { kind: 'format-1' },
          { kind: 'newer' },
          { kind: 'broken' },
          (unreadable) =>
            Promise.resolve<RunWriteResult>({
              kind: 'refused',
              refusal: buildReadRefusal(unreadable, { name: input.name, folder: input.folder }),
            }),
        )
        .with({ kind: 'missing' }, () => {
          throw new Error(`the store of ${input.name} vanished under a write`);
        })
        .exhaustive();
    },
    { waitMs: 2000 },
  );

  return match(locked)
    .with({ kind: 'ran' }, (ran) => ran.value)
    .with({ kind: 'busy' }, (busy): RunWriteResult => ({
      kind: 'refused',
      refusal: buildRefusal({
        kind: 'lock-busy',
        args: input.args,
        name: input.name,
        pid: busy.pid,
      }),
    }))
    .exhaustive();
}

async function writeOnce(
  input: WriteRequest,
  store: Store,
  probed: WriteProbe | null,
): Promise<RunWriteResult> {
  const picked = input.pick({
    store,
    journal: await readJournalIndex(input.folder),
    args: input.args,
    cwd: input.cwd,
    nowMs: input.nowMs,
    probed,
  });

  return match(picked)
    .with({ kind: 'refused' }, (refused): Promise<RunWriteResult> =>
      Promise.resolve({ kind: 'refused', refusal: refused.refusal }),
    )
    .with({ kind: 'write' }, async (write): Promise<RunWriteResult> => {
      await writeStoreFiles(input.folder, write.change);

      const written = {
        ...store,
        session: write.change.session ?? store.session,
        items: write.change.items ?? store.items,
        notes: write.change.notes ?? store.notes,
      };

      const briefLines =
        renderBrief(
          buildReplyBriefInput(written, {
            nowMs: input.nowMs,
            sessionFlag: input.args.sessionFlag,
            host: input.host,
          }),
        ).split('\n').length - 1;

      return { kind: 'replied', reply: write.reply(briefLines) };
    })
    .exhaustive();
}
