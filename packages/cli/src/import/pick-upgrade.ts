import { join } from 'node:path';
import { formatTimestamp } from '../format-timestamp.ts';
import { buildRefusal } from '../refusals/build-refusal.ts';
import { buildBindRow } from '../sessions/build-bind-row.ts';
import { notesHeader } from '../store/constants.ts';
import { parseItemsFile } from '../store/parse-items-file.ts';
import { parseNotesFile } from '../store/parse-notes-file.ts';
import type { NotesParse } from '../store/parse-notes-file.ts';
import type {
  AgentID,
  Item,
  JournalRow,
  Note,
  ParsedArgs,
  Refusal,
  SessionFile,
} from '../types.ts';
import { buildUpgradeParts, toApprovals } from './build-upgrade-parts.ts';
import { collectUpgradeProblems } from './collect-upgrade-problems.ts';
import { findJournalProblem } from './find-journal-problem.ts';
import { parseFormat1Session } from './parse-format-1-session.ts';
import type { Format1Item, Format1Session } from './types.ts';

export interface Format1Files {
  readonly session: string;
  readonly items: string;

  // null when notes.tsv is missing
  readonly notes: string | null;
  readonly journal: string;
}

export type UpgradePick =
  | { readonly kind: 'refused'; readonly refusal: Refusal }
  | {
      readonly kind: 'upgrade';

      // format 2
      readonly session: SessionFile;
      readonly items: readonly Item[];
      readonly notes: readonly Note[];

      // appended after the format 1 rows
      readonly journalRows: readonly JournalRow[];

      // printed in the reply
      readonly removedNotes: readonly Note[];

      // standing approvals removed
      readonly folded: number;

      // one-time approvals kept, 0 or 1
      readonly kept: number;
    };

interface UpgradeOptions {
  readonly name: string;

  // the session folder, for the path a broken file names
  readonly folder: string;
  readonly args: ParsedArgs;
  readonly nowMs: number;
  readonly byOwner: boolean;
  readonly agent: AgentID | null;
}

// Checks the format 1 store against the flags, and says what the format 2 store is. A refusal
// holds every problem it found. It reads nothing and writes nothing.
export function pickUpgrade(files: Format1Files, options: UpgradeOptions): UpgradePick {
  const parsed = parseFormat1Files(files, options);

  if (parsed.kind === 'refused') {
    return parsed;
  }

  const session = parsed.session;
  const items = parsed.items;
  const notes = parsed.notes;
  const args = options.args;

  const problems = collectUpgradeProblems({
    args,
    approvals: toApprovals(items),
    itemIDs: items.map((item) => item.id),
    nowMs: options.nowMs,
  });

  if (problems.length > 0) {
    return {
      kind: 'refused',
      refusal: buildRefusal({
        kind: 'upgrade-refused',
        args,
        name: options.name,
        rowProblems: [],
        problems,
      }),
    };
  }

  const parts = buildUpgradeParts(items, args, options);

  const keptIDs = new Set(parts.items.map((item) => item.id));

  const ts = formatTimestamp(options.nowMs);

  return {
    kind: 'upgrade',
    session: {
      ...session,
      format: '2',
      grant: parts.grant,
      lastWrite: ts,
      ...(session.now !== null && parts.removedIDs.has(session.now)
        ? { now: null, nowNext: null, nowSet: null }
        : {}),
    },
    items: parts.items,
    notes: notes.filter((note) => keptIDs.has(note.id)),
    removedNotes: items.flatMap((item) =>
      parts.removedIDs.has(item.id) ? notes.filter((note) => note.id === item.id) : [],
    ),
    journalRows: [
      ...parts.journalRows,
      {
        ts,
        op: 'import',
        id: options.name,
        by: 'agent',
        text: 'format 1 -> 2',
        why: null,
        extra: null,
      },
      ...(options.agent === null
        ? []
        : [buildBindRow(options.name, 'import', options.agent, options.nowMs)]),
    ],
    folded: parts.folded,
    kept: parts.kept,
  };
}

type ParsedFiles =
  | { readonly kind: 'refused'; readonly refusal: Refusal }
  | {
      readonly kind: 'parsed';
      readonly session: Format1Session;
      readonly items: readonly Format1Item[];
      readonly notes: readonly Note[];
    };

function parseFormat1Files(files: Format1Files, options: UpgradeOptions): ParsedFiles {
  const refuseBroken = (file: string, line: number | null, reason: string): ParsedFiles => ({
    kind: 'refused',
    refusal: buildRefusal({
      kind: 'broken-store',
      name: options.name,
      file,
      path: join(options.folder, file),
      line,
      reason,
    }),
  });

  const session = parseFormat1Session(files.session);

  if (session.kind === 'broken') {
    return refuseBroken('session', null, session.reason);
  }

  const items = parseItemsFile(files.items, '1');

  if (items.kind === 'broken') {
    return refuseBroken('items.tsv', items.line, items.reason);
  }

  const notes = parseFormat1Notes(files.notes);

  if (notes.kind === 'broken') {
    return refuseBroken('notes.tsv', notes.line, notes.reason);
  }

  const journal = findJournalProblem(files.journal);

  if (journal !== null) {
    return refuseBroken('journal.tsv', journal.line, journal.reason);
  }

  return { kind: 'parsed', session: session.session, items: items.items, notes: notes.notes };
}

// A format 1 store may hold an item grant, which the notes rules no longer take as an id. Its note
// row is read under another id and put back in its place.
function parseFormat1Notes(text: string | null): NotesParse {
  if (text === null) {
    return { kind: 'notes', notes: [] };
  }

  const lines = text.split('\n');
  const grantAt = lines.findIndex((line) => line.startsWith('grant\t'));

  if (grantAt === -1) {
    return parseNotesFile(text);
  }

  const others = parseNotesFile(lines.filter((_line, at) => at !== grantAt).join('\n'));
  const own = parseNotesFile(`${notesHeader}\nzz${lines[grantAt]?.slice('grant'.length) ?? ''}\n`);

  if (others.kind === 'broken') {
    return others;
  }

  if (own.kind === 'broken') {
    return { ...own, line: grantAt + 1 };
  }

  const restored = own.notes.map((note) => ({
    id: 'grant',
    owed: note.owed,
    written: note.written,
    note: note.note,
  }));

  return { kind: 'notes', notes: others.notes.toSpliced(Math.max(grantAt - 1, 0), 0, ...restored) };
}
