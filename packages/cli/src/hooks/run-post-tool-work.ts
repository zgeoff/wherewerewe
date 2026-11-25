import { join } from 'node:path';
import { formatAge } from '../brief/format-age.ts';
import { formatTimestamp } from '../format-timestamp.ts';
import { buildBindRow } from '../sessions/build-bind-row.ts';
import { readBinding } from '../sessions/read-binding.ts';
import { withBindingLock } from '../sessions/with-binding-lock.ts';
import { writeBinding } from '../sessions/write-binding.ts';
import { formatPrsFile } from '../store/format-prs-file.ts';
import { parsePrsFile } from '../store/parse-prs-file.ts';
import { readSessionFile } from '../store/read-session-file.ts';
import { readTextOrNull } from '../store/read-text-or-null.ts';
import { withStoreLock } from '../store/with-store-lock.ts';
import { writeFileAtomic } from '../store/write-file-atomic.ts';
import { writeStoreFiles } from '../store/write-store-files.ts';
import type { SessionFile } from '../types.ts';
import { gateTexts } from './gate-texts.ts';
import { isNudgeDue } from './is-nudge-due.ts';
import type { PostToolWork } from './pick-post-tool-work.ts';
import type { Harness, HookContext } from './types.ts';
import { writeHookLog } from './write-hook-log.ts';

export interface PostToolTarget {
  readonly harness: Harness;
  readonly sessionID: string;

  // the session the agent session id is bound to, null when it has no binding
  readonly name: string | null;
}

// PostToolUse steps 1 to 3, each under the store's lock: the bind of an init, attach or import, the
// pull request record, and the nudge. Returns the nudge's line when one is due. A step that cannot
// take the lock is skipped and logged, and the call runs.
export async function runPostToolWork(
  context: HookContext,
  target: PostToolTarget,
  work: PostToolWork,
): Promise<string | null> {
  try {
    await runBind(context, target, work);

    if (target.name === null) {
      return null;
    }

    return await runRecord(context, target.name, work);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'a step failed';

    writeHookLog(context, target.harness, 'PostToolUse', message);

    return null;
  }
}

const storeWaitMs = 1500;

async function runBind(
  context: HookContext,
  target: PostToolTarget,
  work: PostToolWork,
): Promise<void> {
  if (work.bind === null) {
    return;
  }

  const name = work.bind.name;
  const folder = join(context.root, name);

  const session = await readSessionFile(folder);

  const agent = { harness: target.harness, id: target.sessionID };

  if (session.kind === 'missing' || (await readBinding(context.root, agent)) === name) {
    return;
  }

  const locked = await withStoreLock(
    folder,
    () =>
      withBindingLock(context.root, async () => {
        const row = buildBindRow(name, work.bind?.verb ?? '', agent, context.now());

        await writeStoreFiles(folder, { journal: [{ ...row, by: 'hook' }] });
        await writeBinding(context.root, agent, name);
      }),
    { waitMs: storeWaitMs },
  );

  if (locked.kind === 'busy' || locked.value.kind === 'busy') {
    writeHookLog(context, target.harness, 'PostToolUse', 'the lock was busy; the bind is skipped');
  }
}

async function runRecord(
  context: HookContext,
  name: string,
  work: PostToolWork,
): Promise<string | null> {
  if (work.prRef === null && !work.isNudgeCommand) {
    return null;
  }

  const folder = join(context.root, name);

  const locked = await withStoreLock(
    folder,
    async () => {
      const read = await readSessionFile(folder);

      if (read.kind !== 'session') {
        return null;
      }

      await writePullRequest(context, folder, work.prRef);

      return writeNudge(context, folder, read.session, work);
    },
    { waitMs: storeWaitMs },
  );

  if (locked.kind === 'busy') {
    writeHookLog(context, 'hook', 'PostToolUse', 'the lock was busy; the record is skipped');

    return null;
  }

  return locked.value;
}

async function writePullRequest(
  context: HookContext,
  folder: string,
  ref: string | null,
): Promise<void> {
  if (ref === null) {
    return;
  }

  const path = join(folder, 'prs.tsv');

  const text = await readTextOrNull(path);

  const parsed = text === null ? { kind: 'prs' as const, prs: [] } : parsePrsFile(text);

  if (parsed.kind === 'broken') {
    writeHookLog(context, 'hook', 'PostToolUse', 'prs.tsv does not parse; the record is skipped');

    return;
  }

  if (parsed.prs.some((row) => row.ref === ref)) {
    return;
  }

  const ts = formatTimestamp(context.now());

  await writeStoreFiles(folder, {
    journal: [{ ts, op: 'pr', id: ref, by: 'hook', text: null, why: null, extra: null }],
  });

  writeFileAtomic(
    path,
    formatPrsFile([...parsed.prs, { ref, opened: ts, state: null, seen: null }]),
  );
}

async function writeNudge(
  context: HookContext,
  folder: string,
  session: SessionFile,
  work: PostToolWork,
): Promise<string | null> {
  if (!work.isNudgeCommand || !isNudgeDue(session, context.now())) {
    return null;
  }

  const nowMs = context.now();
  const age = formatAge(nowMs - Date.parse(session.lastWrite ?? session.started));

  await writeStoreFiles(folder, {
    session: { ...session, lastNudge: formatTimestamp(nowMs) },
    journal: [],
  });

  return gateTexts.nudge(session.name, age);
}
