import { match } from 'ts-pattern';
import { buildReadRefusal } from '../refusals/build-read-refusal.ts';
import { buildRefusal } from '../refusals/build-refusal.ts';
import { readJournalIndex } from '../store/read-journal-index.ts';
import { readStore } from '../store/read-store.ts';
import { withStoreLock } from '../store/with-store-lock.ts';
import { writeOwnerFiles } from '../store/write-owner-files.ts';
import type { ParsedArgs, Store } from '../types.ts';
import { readBriefFigure } from './read-brief-figure.ts';
import type { RunWriteResult } from './run-write.ts';
import type { OwnerWriteResult, WriteInput } from './types.ts';

export interface OwnerWriteRequest {
  readonly folder: string;
  readonly name: string;
  readonly args: ParsedArgs;
  readonly cwd: string;
  readonly nowMs: number;

  // the agent that runs the write, which sets the limit of the brief it counts
  readonly host: 'claude' | 'codex' | null;
  readonly pick: (input: WriteInput) => OwnerWriteResult;
}

// The thin locked write of say and ack: inside the lock it reads the store and the journal index,
// asks the pure function what to do, writes owner.tsv and the journal, and counts the tokens of the
// brief as written. It changes no session key.
export async function runOwnerWrite(input: OwnerWriteRequest): Promise<RunWriteResult> {
  const locked = await withStoreLock(
    input.folder,
    async (): Promise<RunWriteResult> => {
      const read = await readStore(input.folder);

      return match(read)
        .with({ kind: 'store' }, (found) => writeOnce(input, found.store))
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

async function writeOnce(input: OwnerWriteRequest, store: Store): Promise<RunWriteResult> {
  if (store.ownerUnread !== null) {
    return {
      kind: 'refused',
      refusal: buildReadRefusal(
        {
          kind: 'broken',
          file: store.ownerUnread.file,
          line: store.ownerUnread.line,
          reason: store.ownerUnread.reason,
          partial: null,
        },
        { name: input.name, folder: input.folder },
      ),
    };
  }

  const picked = input.pick({
    store,
    journal: await readJournalIndex(input.folder),
    args: input.args,
    cwd: input.cwd,
    nowMs: input.nowMs,
    probed: null,
  });

  return match(picked)
    .with({ kind: 'refused' }, (refused): RunWriteResult => refused)
    .with({ kind: 'write' }, async (write): Promise<RunWriteResult> => {
      writeOwnerFiles(input.folder, write.change);

      const written = { ...store, ownerNotes: write.change.notes };

      const figure = await readBriefFigure(input.folder, written, {
        nowMs: input.nowMs,
        sessionFlag: input.args.sessionFlag,
        host: input.host,
      });

      return { kind: 'replied', reply: write.reply(figure) };
    })
    .exhaustive();
}
