import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { match } from 'ts-pattern';
import type {
  LessonRow,
  Note,
  OwnerNote,
  PromiseRow,
  PullRequestRow,
  SessionFile,
  Store,
  UnreadRows,
  WordsRow,
} from '../types.ts';
import { parseItemsFile } from './parse-items-file.ts';
import { parseLessonsFile } from './parse-lessons-file.ts';
import { parseNotesFile } from './parse-notes-file.ts';
import { parseOwnerFile } from './parse-owner-file.ts';
import { parsePromisesFile } from './parse-promises-file.ts';
import { parsePrsFile } from './parse-prs-file.ts';
import type { RowsParse } from './parse-rows-file.ts';
import { parseSessionFile } from './parse-session-file.ts';
import { parseWordsFile } from './parse-words-file.ts';

export interface ReadStoreOptions {
  // false leaves prs.tsv unopened and the store with no rows of it
  readonly isPrsRead: boolean;
}

const readsPrs: ReadStoreOptions = { isPrsRead: true };

export type StoreRead =
  | { readonly kind: 'store'; readonly store: Store }
  | { readonly kind: 'missing' }
  | { readonly kind: 'hand-kept' }
  | { readonly kind: 'format-1' }
  | { readonly kind: 'newer'; readonly format: string }
  | {
      readonly kind: 'broken';
      readonly file: string;
      readonly line: number | null;
      readonly reason: string;

      // what a read can still print: the session, with the item rows that parse. A write never
      // uses it. Null when the session file itself is broken.
      readonly partial: Store | null;
    };

// Reads `session`, stopping at a hand-kept, format 1 or newer store, then `items.tsv`, `notes.tsv` and
// `owner.tsv`. A broken `notes.tsv` or `owner.tsv` never makes the store broken: its rows that parse
// come back, with the one that does not named in `notesUnread` or `ownerUnread`. Never the journal.
export async function readStore(
  folder: string,
  options: ReadStoreOptions = readsPrs,
): Promise<StoreRead> {
  const sessionText = await readTextOrNull(join(folder, 'session'));

  if (sessionText === null) {
    return { kind: 'missing' };
  }

  return match(parseSessionFile(sessionText))
    .with({ kind: 'hand-kept' }, (found): StoreRead => found)
    .with({ kind: 'format-1' }, (found): StoreRead => found)
    .with({ kind: 'newer' }, (found): StoreRead => found)
    .with({ kind: 'broken' }, (found): StoreRead => ({
      kind: 'broken',
      file: 'session',
      line: null,
      reason: found.reason,
      partial: null,
    }))
    .with({ kind: 'session' }, (found) => readItems(folder, found.session, options))
    .exhaustive();
}

async function readTextOrNull(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return null;
    }

    throw error;
  }
}

async function readItems(
  folder: string,
  session: SessionFile,
  options: ReadStoreOptions,
): Promise<StoreRead> {
  const itemsText = await readTextOrNull(join(folder, 'items.tsv'));

  const owner = {
    ...(await readOwner(folder)),
    ...(await readKinds(folder)),
    ...(options.isPrsRead ? await readPrs(folder) : { prs: [], prsUnread: null }),
  };

  const noteRead = await readNotes(folder);

  if (itemsText === null) {
    return {
      kind: 'broken',
      file: 'items.tsv',
      line: null,
      reason: 'the file is missing',
      partial: { folder, session, items: [], ...keepOpenNotes(noteRead, []), ...owner },
    };
  }

  return match(parseItemsFile(itemsText, '2'))
    .with({ kind: 'items' }, (found): StoreRead => ({
      kind: 'store',
      store: {
        folder,
        session,
        items: found.items,
        ...keepOpenNotes(noteRead, found.items),
        ...owner,
      },
    }))
    .with({ kind: 'broken' }, (found): StoreRead => ({
      kind: 'broken',
      file: 'items.tsv',
      line: found.line,
      reason: found.reason,
      partial: {
        folder,
        session,
        items: found.items,
        ...keepOpenNotes(noteRead, found.items),
        ...owner,
      },
    }))
    .exhaustive();
}

interface OwnerRead {
  readonly ownerNotes: readonly OwnerNote[];
  readonly ownerUnread: UnreadRows | null;
}

// A file system error on owner.tsv, such as a folder in its place or no read access, reads as a
// broken owner file and never stops the brief or an agent write.
async function readOwner(folder: string): Promise<OwnerRead> {
  try {
    const ownerText = await readTextOrNull(join(folder, 'owner.tsv'));

    return ownerText === null ? { ownerNotes: [], ownerUnread: null } : readOwnerText(ownerText);
  } catch (error) {
    if (error instanceof Error && 'code' in error && typeof error.code === 'string') {
      return {
        ownerNotes: [],
        ownerUnread: {
          file: 'owner.tsv',
          line: null,
          reason: `the file cannot be read (${error.code})`,
        },
      };
    }

    throw error;
  }
}

function readOwnerText(ownerText: string): OwnerRead {
  return match(parseOwnerFile(ownerText))
    .with({ kind: 'notes' }, (found): OwnerRead => ({ ownerNotes: found.notes, ownerUnread: null }))
    .with({ kind: 'broken' }, (found): OwnerRead => ({
      ownerNotes: found.notes,
      ownerUnread: { file: 'owner.tsv', line: found.line, reason: found.reason },
    }))
    .exhaustive();
}

interface KindsRead {
  readonly lessons: readonly LessonRow[];
  readonly promises: readonly PromiseRow[];
  readonly words: readonly WordsRow[];
  readonly lessonsUnread: UnreadRows | null;
  readonly promisesUnread: UnreadRows | null;
  readonly wordsUnread: UnreadRows | null;
}

// A missing lessons.tsv, promises.tsv or words.tsv reads as no rows, and a row that does not parse
// is left out and named, as for notes.tsv.
async function readKinds(folder: string): Promise<KindsRead> {
  const lessons = await readRows(folder, 'lessons.tsv', parseLessonsFile);
  const promises = await readRows(folder, 'promises.tsv', parsePromisesFile);
  const words = await readRows(folder, 'words.tsv', parseWordsFile);

  return {
    lessons: lessons.rows,
    lessonsUnread: lessons.unread,
    promises: promises.rows,
    promisesUnread: promises.unread,
    words: words.rows,
    wordsUnread: words.unread,
  };
}

async function readRows<Row extends { readonly id: string }>(
  folder: string,
  file: string,
  parse: (text: string) => RowsParse<Row>,
): Promise<{ readonly rows: readonly Row[]; readonly unread: UnreadRows | null }> {
  try {
    const text = await readTextOrNull(join(folder, file));

    if (text === null) {
      return { rows: [], unread: null };
    }

    const found = parse(text);

    return found.kind === 'rows'
      ? { rows: found.rows, unread: null }
      : { rows: found.rows, unread: { file, line: found.line, reason: found.reason } };
  } catch (error) {
    if (error instanceof Error && 'code' in error && typeof error.code === 'string') {
      return {
        rows: [],
        unread: { file, line: null, reason: `the file cannot be read (${error.code})` },
      };
    }

    throw error;
  }
}

interface PrsRead {
  readonly prs: readonly PullRequestRow[];
  readonly prsUnread: UnreadRows | null;
}

// A missing prs.tsv reads as no rows. A file system error reads as a broken file, as owner.tsv's
// does.
async function readPrs(folder: string): Promise<PrsRead> {
  try {
    const text = await readTextOrNull(join(folder, 'prs.tsv'));

    return text === null ? { prs: [], prsUnread: null } : readPrsText(text);
  } catch (error) {
    if (error instanceof Error && 'code' in error && typeof error.code === 'string') {
      return {
        prs: [],
        prsUnread: {
          file: 'prs.tsv',
          line: null,
          reason: `the file cannot be read (${error.code})`,
        },
      };
    }

    throw error;
  }
}

function readPrsText(text: string): PrsRead {
  return match(parsePrsFile(text))
    .with({ kind: 'prs' }, (found): PrsRead => ({ prs: found.prs, prsUnread: null }))
    .with({ kind: 'broken' }, (found): PrsRead => ({
      prs: found.prs,
      prsUnread: { file: 'prs.tsv', line: found.line, reason: found.reason },
    }))
    .exhaustive();
}

interface NotesRead {
  readonly notes: readonly Note[];
  readonly notesUnread: UnreadRows | null;
}

// A missing notes.tsv reads as no notes. A file system error reads as a broken file, as owner.tsv's
// does.
async function readNotes(folder: string): Promise<NotesRead> {
  try {
    const text = await readTextOrNull(join(folder, 'notes.tsv'));

    return text === null ? { notes: [], notesUnread: null } : readNotesText(text);
  } catch (error) {
    if (error instanceof Error && 'code' in error && typeof error.code === 'string') {
      return {
        notes: [],
        notesUnread: {
          file: 'notes.tsv',
          line: null,
          reason: `the file cannot be read (${error.code})`,
        },
      };
    }

    throw error;
  }
}

function readNotesText(text: string): NotesRead {
  return match(parseNotesFile(text))
    .with({ kind: 'notes' }, (found): NotesRead => ({ notes: found.notes, notesUnread: null }))
    .with({ kind: 'broken' }, (found): NotesRead => ({
      notes: found.notes,
      notesUnread: { file: 'notes.tsv', line: found.line, reason: found.reason },
    }))
    .exhaustive();
}

function keepOpenNotes(read: NotesRead, items: readonly { readonly id: string }[]): NotesRead {
  return {
    notes: read.notes.filter((note) => items.some((item) => item.id === note.id)),
    notesUnread: read.notesUnread,
  };
}
