import { parseHandKeptStore } from '../import/parse-hand-kept-store.ts';
import type { HandKeptStore } from '../import/parse-hand-kept-store.ts';
import { buildHandKeptItemRow } from './build-hand-kept-item-row.ts';

// A hand-kept store named old-notes with one approval per extra, each owner, chat and the repo
// with the token the extra gives, such as `once` or `standing`.
export function buildHandKeptApprovals(extras: readonly string[]): HandKeptStore {
  const rows = extras.map((extra, index) =>
    buildHandKeptItemRow({
      id: `ok-${String(index)}`,
      kind: 'ok',
      claim: `Approval ${String(index)}`,
      extra: `who=owner;where=chat;scope=the repo;${extra}`,
    }),
  );

  return parseHandKeptStore({
    session: 'name=old-notes\ngoal=Ship it\nstarted=2026-03-02T08:00:00Z\n',
    items: `${['id\tkind\tclaim\tcheck\tat_write\tlast\twritten\tby\textra', ...rows].join('\n')}\n`,
    journal: 'ts\top\tid\ttext\n',
  });
}
