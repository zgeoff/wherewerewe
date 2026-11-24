import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { match } from 'ts-pattern';
import { findFormat } from '../import/find-format.ts';
import { parseHandKeptStore } from '../import/parse-hand-kept-store.ts';
import type { HandKeptFiles } from '../import/parse-hand-kept-store.ts';
import { pickImport } from '../import/pick-import.ts';
import { buildReadRefusal } from '../refusals/build-read-refusal.ts';
import { buildRefusalScope } from '../refusals/build-refusal-scope.ts';
import { buildRefusal } from '../refusals/build-refusal.ts';
import { formatRefusal } from '../refusals/format-refusal.ts';
import { isSessionName } from '../rules/is-session-name.ts';
import { findAgentID } from '../sessions/find-agent-id.ts';
import { readSessionSummaries } from '../sessions/read-session-summaries.ts';
import { withBindingLock } from '../sessions/with-binding-lock.ts';
import { writeBinding } from '../sessions/write-binding.ts';
import { journalHeader } from '../store/constants.ts';
import { formatItemsFile } from '../store/format-items-file.ts';
import { formatJournalRows } from '../store/format-journal-rows.ts';
import { formatSessionFile } from '../store/format-session-file.ts';
import { isErrorCode } from '../store/is-error-code.ts';
import { readStore } from '../store/read-store.ts';
import { withStoreLock } from '../store/with-store-lock.ts';
import { writeImportFiles } from '../store/write-import-files.ts';
import type { CLIResult, Refusal } from '../types.ts';
import type { CommandContext } from './types.ts';

export async function runImportCommand(context: CommandContext): Promise<CLIResult> {
  const name = context.args.positionals[0] ?? '';
  const folder = join(context.root, name);

  if (!isSessionName(name) || !existsSync(join(folder, 'session'))) {
    return replyNoSession(context, name);
  }

  const locked = await withStoreLock(folder, () => importStore(context, name, folder), {
    waitMs: 2000,
  });

  return match(locked)
    .with({ kind: 'ran' }, (ran) => ran.value)
    .with({ kind: 'busy' }, (busy) =>
      replyRefusal(
        buildRefusal({ kind: 'lock-busy', args: context.args, name, pid: busy.pid }),
        context,
      ),
    )
    .exhaustive();
}

async function replyNoSession(context: CommandContext, name: string): Promise<CLIResult> {
  const summaries = await readSessionSummaries(context.root);

  const sessions = summaries.map((summary) => summary.name);

  return replyRefusal(buildRefusal({ kind: 'import-no-session', name, sessions }), context);
}

function replyRefusal(refusal: Refusal, context: CommandContext): CLIResult {
  return {
    exitCode: refusal.exitCode,
    stdout: '',
    stderr: formatRefusal(refusal, buildRefusalScope(context.args)),
  };
}

async function importStore(
  context: CommandContext,
  name: string,
  folder: string,
): Promise<CLIResult> {
  const sessionFile = await readTextOrNull(join(folder, 'session'));

  const sessionText = sessionFile ?? '';
  const format = findFormat(sessionText);

  if (format === '1') {
    return replyFormat1(context, name, folder);
  }

  if (format !== null && format !== '0-by-hand') {
    return replyRefusal(buildReadRefusal({ kind: 'newer', format }, { name, folder }), context);
  }

  const originals = await readOriginals(folder);

  const agent = findAgentID(context.env);
  const picked = pickImport(parseHandKeptStore(originals), { name, nowMs: context.nowMs, agent });

  if (picked.kind === 'refused') {
    return replyRefusal(
      buildRefusal({ kind: 'import-broken-rows', name, problems: picked.problems }),
      context,
    );
  }

  const write = {
    originals,
    converted: {
      session: formatSessionFile(picked.session),
      items: formatItemsFile(picked.items),
      journal: `${journalHeader}\n${formatJournalRows(picked.journal)}`,
    },
  };

  if (agent === null) {
    writeImportFiles(folder, write);
  } else {
    // The binding lock comes first, so a busy lock converts nothing. The binding comes last, so a
    // stop never binds the agent to a hand-kept store; a stop just before it leaves a format 1 store
    // whose refusal on a rerun gives www attach as its Run line.
    const bound = await withBindingLock(context.root, async () => {
      writeImportFiles(folder, write);

      await writeBinding(context.root, agent, name);
    });

    if (bound.kind === 'busy') {
      return replyRefusal(
        buildRefusal({ kind: 'lock-busy', args: context.args, name, pid: bound.pid }),
        context,
      );
    }
  }

  return {
    exitCode: 0,
    stdout: `Imported ${name}: ${String(picked.items.length)} items, ${String(picked.carried)} journal rows. Originals in ${folder}/import-backup/.\n`,
    stderr: '',
  };
}

async function readTextOrNull(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    if (isErrorCode(error, 'ENOENT')) {
      return null;
    }

    throw error;
  }
}

// A store that reads whole is refused as converted already, with a Run line that binds the agent.
// A broken one gets the refusal every read gives it, so that Run line never fails on it.
async function replyFormat1(
  context: CommandContext,
  name: string,
  folder: string,
): Promise<CLIResult> {
  const read = await readStore(folder);

  return match(read)
    .with({ kind: 'store' }, () =>
      replyRefusal(
        buildRefusal({
          kind: 'import-already-format-1',
          name,
          hasAgent: findAgentID(context.env) !== null,
        }),
        context,
      ),
    )
    .with({ kind: 'missing' }, () => replyNoSession(context, name))
    .with({ kind: 'hand-kept' }, { kind: 'newer' }, { kind: 'broken' }, (unreadable) =>
      replyRefusal(buildReadRefusal(unreadable, { name, folder }), context),
    )
    .exhaustive();
}

async function readOriginals(folder: string): Promise<HandKeptFiles> {
  const backup = join(folder, 'import-backup');
  const source = existsSync(backup) ? backup : folder;

  const session = await readTextOrNull(join(source, 'session'));
  const items = await readTextOrNull(join(source, 'items.tsv'));
  const journal = await readTextOrNull(join(source, 'journal.tsv'));

  return { session: session ?? '', items, journal };
}
