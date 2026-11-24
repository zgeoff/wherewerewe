import { join } from 'node:path';
import type { FileKind, RefusalReason, Store, UnreadRows } from '../types.ts';

const files = { lesson: 'lessons.tsv', promise: 'promises.tsv', words: 'words.tsv' } as const;

// A write of a kind whose file has a row that does not parse refuses: the row left out may be the
// one the write would replace or close.
export function pickBrokenFileRefusal(store: Store, kind: FileKind): RefusalReason | null {
  const unreadRows: Readonly<Record<FileKind, UnreadRows | null>> = {
    lesson: store.lessonsUnread,
    promise: store.promisesUnread,
    words: store.wordsUnread,
  };

  const unread = unreadRows[kind];

  return unread === null
    ? null
    : {
        kind: 'broken-store',
        name: store.session.name,
        file: files[kind],
        path: join(store.folder, files[kind]),
        line: unread.line,
        reason: unread.reason,
      };
}
