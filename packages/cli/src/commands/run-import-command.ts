import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { match } from 'ts-pattern';
import { parseHandKeptStore } from '../import/parse-hand-kept-store.ts';
import type { HandKeptFiles } from '../import/parse-hand-kept-store.ts';
import { pickImport } from '../import/pick-import.ts';
import { buildReadRefusal } from '../refusals/build-read-refusal.ts';
import { buildRefusal } from '../refusals/build-refusal.ts';
import { formatRefusal } from '../refusals/format-refusal.ts';
import { readRefusalScope } from '../refusals/read-refusal-scope.ts';
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
import { parseSessionFile } from '../store/parse-session-file.ts';
import { withStoreLock } from '../store/with-store-lock.ts';
import { writeImportFiles } from '../store/write-import-files.ts';
import type { CLIResult, Refusal } from '../types.ts';
import type { CommandContext } from './types.ts';

// Converts the hand-kept store named by the argument to format 1, in place.
export async function runImportCommand(context: CommandContext): Promise<CLIResult> {
  const name = context.args.positionals[0] ?? '';
  const folder = join(context.root, name);

  if (!isSessionName(name) || !existsSync(join(folder, 'session'))) {
    const summaries = await readSessionSummaries(context.root);

    const sessions = summaries.map((summary) => summary.name);

    return replyRefusal(buildRefusal({ kind: 'import-no-session', name, sessions }), context);
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

function replyRefusal(refusal: Refusal, context: CommandContext): CLIResult {
  return {
    exitCode: refusal.exitCode,
    stdout: '',
    stderr: formatRefusal(refusal, readRefusalScope(context.args)),
  };
}

async function importStore(
  context: CommandContext,
  name: string,
  folder: string,
): Promise<CLIResult> {
  const sessionFile = await readTextOrNull(join(folder, 'session'));

  const sessionText = sessionFile ?? '';
  const format = readFormat(sessionText);

  if (format === '1') {
    const parsed = parseSessionFile(sessionText);

    return parsed.kind === 'broken'
      ? replyRefusal(
          buildReadRefusal(
            { kind: 'broken', file: 'session', line: null, reason: parsed.reason, partial: null },
            { name, folder },
          ),
          context,
        )
      : replyRefusal(buildRefusal({ kind: 'import-already-format-1', name }), context);
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

  writeImportFiles(folder, {
    originals,
    converted: {
      session: formatSessionFile(picked.session),
      items: formatItemsFile(picked.items),
      journal: `${journalHeader}\n${formatJournalRows(picked.journal)}`,
    },
  });

  if (agent !== null) {
    await withBindingLock(context.root, () => writeBinding(context.root, agent, name));
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

// The value of the last format line, or null when there is none.
function readFormat(sessionText: string): string | null {
  const values = sessionText
    .split('\n')
    .filter((line) => line.startsWith('format='))
    .map((line) => line.slice('format='.length));

  return values.at(-1) ?? null;
}

// The originals come from import-backup/ when it exists: an earlier import finished its backup, so
// it holds the true originals, and the session folder may hold some converted files.
async function readOriginals(folder: string): Promise<HandKeptFiles> {
  const backup = join(folder, 'import-backup');
  const source = existsSync(backup) ? backup : folder;

  const session = await readTextOrNull(join(source, 'session'));
  const items = await readTextOrNull(join(source, 'items.tsv'));
  const journal = await readTextOrNull(join(source, 'journal.tsv'));

  return { session: session ?? '', items, journal };
}
