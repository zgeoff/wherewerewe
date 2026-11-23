import { expect, test } from 'bun:test';
import { formatItemsFile } from '../store/format-items-file.ts';
import { formatJournalRows } from '../store/format-journal-rows.ts';
import { formatSessionFile } from '../store/format-session-file.ts';
import { parseItemsFile } from '../store/parse-items-file.ts';
import { parseJournalFile } from '../store/parse-journal-file.ts';
import { parseSessionFile } from '../store/parse-session-file.ts';
import { buildHandKeptItemRow } from '../test-utils/build-hand-kept-item-row.ts';
import { buildHandKeptQuestionRow } from '../test-utils/build-hand-kept-question-row.ts';
import { buildMockJournalRow } from '../test-utils/build-mock-journal-row.ts';
import { parseHandKeptStore } from './parse-hand-kept-store.ts';
import { pickImport } from './pick-import.ts';

function setupTest() {
  const itemsHead = 'id\tkind\tclaim\tcheck\tat_write\tlast\twritten\tby\textra';
  const journalHead = 'ts\top\tid\ttext';
  const formatOneHead = 'ts\top\tid\tby\ttext\twhy\textra';

  const sessionText =
    'name=old-notes\ngoal=Ship it\nstarted=2026-03-02T08:00:00Z\nnow=t-a\nnow_next=go\nnow_set=2026-03-02T09:30:00Z\nformat=0-by-hand\n';

  const taskRow = 't-a\ttask\tWrite it\t-\t-\t-\t2026-03-02T09:00:00Z\tagent\t-';
  const initRow = '2026-03-02T08:00:00Z\tinit\told-notes\tStart';
  const approvalExtra = 'who=owner;where=chat;scope=the repo;once';
  const nowMs = Date.parse('2026-03-10T11:43:00Z');
  const agent = { harness: 'claude', id: 'a1b2-test' } as const;

  interface HandFiles {
    readonly session?: string;
    readonly itemsHeader?: string;
    readonly journalHeader?: string;
    readonly items?: readonly string[];
    readonly journal?: readonly string[];
  }

  const idRule =
    'the id breaks the id rule: 2 to 16 characters of a-z, 0-9 and -, starting with a letter, and not d-<n> or o-<n>.';

  const closeHint =
    'Close one by appending the tab-separated row: <ts> closed <id> <what settled it>';

  const pick = (files: HandFiles, withAgent = true) =>
    pickImport(
      parseHandKeptStore({
        session: files.session ?? sessionText,
        items: `${[files.itemsHeader ?? itemsHead, ...(files.items ?? [taskRow])].join('\n')}\n`,
        journal: `${[files.journalHeader ?? journalHead, ...(files.journal ?? [initRow])].join('\n')}\n`,
      }),
      { name: 'old-notes', nowMs, agent: withAgent ? agent : null },
    );

  return {
    itemsHead,
    journalHead,
    formatOneHead,
    sessionText,
    taskRow,
    initRow,
    approvalExtra,
    idRule,
    closeHint,
    pick,
  };
}

type TestContext = ReturnType<typeof setupTest>;

test.each([
  {
    title: 'a session line that is not key=value',
    files: (ctx: TestContext) => ({ session: `${ctx.sessionText}bogus\n` }),
    problems: () => ['session line 8: the line is not key=value.'],
  },
  {
    title: 'a session with no goal',
    files: () => ({ session: 'name=old-notes\nstarted=2026-03-02T08:00:00Z\n' }),
    problems: () => ['session (goal): the key is missing.'],
  },
  {
    title: 'a session whose goal is empty',
    files: () => ({ session: 'name=old-notes\ngoal=\nstarted=2026-03-02T08:00:00Z\n' }),
    problems: () => ['session (goal): the key is missing.'],
  },
  {
    title: 'a session whose name is not the folder name',
    files: (ctx: TestContext) => ({
      session: ctx.sessionText.replace('name=old-notes', 'name=other-notes'),
    }),
    problems: () => ['session (name): the name other-notes is not the folder name old-notes.'],
  },
  {
    title: 'a session key that format 1 does not have',
    files: (ctx: TestContext) => ({ session: `${ctx.sessionText}colour=red\n` }),
    problems: () => ['session (colour): format 1 has no key colour. Remove the line.'],
  },
  {
    title: 'a goal over its limit',
    files: (ctx: TestContext) => ({ session: ctx.sessionText.replace('Ship it', 'g'.repeat(201)) }),
    problems: () => ['session (goal): the goal is 201 characters, and the limit is 200.'],
  },
  {
    title: 'a next step over its limit',
    files: (ctx: TestContext) => ({
      session: ctx.sessionText.replace('go\n', `${'n'.repeat(121)}\n`),
    }),
    problems: () => ['session (now_next): the next step is 121 characters, and the limit is 120.'],
  },
  {
    title: 'a goal that looks like a credential',
    files: (ctx: TestContext) => ({
      session: ctx.sessionText.replace('Ship it', `key AKIA${'Q'.repeat(16)}`),
    }),
    problems: () => ['session (goal): the text looks like a credential (it matches AKIA).'],
  },
  {
    title: 'a now that names no open item',
    files: (ctx: TestContext) => ({ session: ctx.sessionText.replace('now=t-a', 'now=t-gone') }),
    problems: () => ['session (now): t-gone names no open item.'],
  },
  {
    title: 'a now that names an item a done row closed',
    files: (ctx: TestContext) => ({
      journal: [ctx.initRow, '2026-03-02T10:00:00Z\tdone\tt-a\tfinished'],
    }),
    problems: () => ['session (now): t-a names no open item.'],
  },
  {
    title: 'a header of items.tsv that changed',
    files: () => ({ itemsHeader: 'id\tkind\tclaim' }),
    problems: () => [
      'items.tsv line 1: the header is not id, kind, claim, check, at_write, last, written, by, extra.',
    ],
  },
  {
    title: 'a header of journal.tsv that changed',
    files: () => ({ journalHeader: 'ts\top' }),
    problems: () => ['journal.tsv line 1: the header is not ts, op, id, text.'],
  },
  {
    title: 'a header of items.tsv with a carriage return',
    files: (ctx: TestContext) => ({ itemsHeader: `${ctx.itemsHead}\r` }),
    problems: () => [
      'items.tsv line 1: the row holds a carriage return. Save the file with LF line endings.',
    ],
  },
  {
    title: 'an items row with 8 columns',
    files: (ctx: TestContext) => ({
      items: [ctx.taskRow, 't-b\ttask\tx\t-\t-\t-\t2026-03-02T09:00:00Z\tagent'],
    }),
    problems: () => ['items.tsv line 3: the row has 8 columns, and items.tsv has 9.'],
  },
  {
    title: 'an item id with a capital',
    files: (ctx: TestContext) => ({ items: [ctx.taskRow, buildHandKeptItemRow({ id: 'T-1' })] }),
    problems: (ctx: TestContext) => [`items.tsv line 3 (T-1): ${ctx.idRule}`],
  },
  {
    title: 'an item id that a decision keeps',
    files: (ctx: TestContext) => ({ items: [ctx.taskRow, buildHandKeptItemRow({ id: 'd-4' })] }),
    problems: (ctx: TestContext) => [`items.tsv line 3 (d-4): ${ctx.idRule}`],
  },
  {
    title: 'the same id on two rows',
    files: (ctx: TestContext) => ({ items: [ctx.taskRow, buildHandKeptItemRow({ id: 't-a' })] }),
    problems: () => ['items.tsv line 3 (t-a): line 2 has the same id.'],
  },
  {
    title: 'a kind that is none of the five',
    files: (ctx: TestContext) => ({ items: [ctx.taskRow, buildHandKeptItemRow({ kind: 'epic' })] }),
    problems: () => ['items.tsv line 3 (t-b): the kind epic is not task, wait, ok, rule or where.'],
  },
  {
    title: 'a check that does not parse',
    files: (ctx: TestContext) => ({
      items: [ctx.taskRow, buildHandKeptItemRow({ check: 'pr:bad' })],
    }),
    problems: () => ['items.tsv line 3 (t-b): the check pr:bad does not parse.'],
  },
  {
    title: 'a rule with a check',
    files: (ctx: TestContext) => ({
      items: [ctx.taskRow, buildHandKeptItemRow({ id: 'r-a', kind: 'rule', check: 'pid:5' })],
    }),
    problems: () => ['items.tsv line 3 (r-a): a rule has no check.'],
  },
  {
    title: 'a by that is none of the three',
    files: (ctx: TestContext) => ({ items: [ctx.taskRow, buildHandKeptItemRow({ by: 'robot' })] }),
    problems: () => ['items.tsv line 3 (t-b): by is robot, and it must be agent, owner or import.'],
  },
  {
    title: 'an empty claim',
    files: (ctx: TestContext) => ({ items: [ctx.taskRow, buildHandKeptItemRow({ claim: '' })] }),
    problems: () => ['items.tsv line 3 (t-b): the claim is empty.'],
  },
  {
    title: 'a claim of one dash',
    files: (ctx: TestContext) => ({ items: [ctx.taskRow, buildHandKeptItemRow({ claim: '-' })] }),
    problems: () => ['items.tsv line 3 (t-b): the claim is empty.'],
  },
  {
    title: 'a claim over its limit',
    files: (ctx: TestContext) => ({
      items: [ctx.taskRow, buildHandKeptItemRow({ claim: 'c'.repeat(121) })],
    }),
    problems: () => ['items.tsv line 3 (t-b): the claim is 121 characters, and the limit is 120.'],
  },
  {
    title: 'an approval quote over its limit',
    files: (ctx: TestContext) => ({
      items: [
        ctx.taskRow,
        buildHandKeptItemRow({
          id: 'ok-a',
          kind: 'ok',
          claim: 'q'.repeat(121),
          extra: ctx.approvalExtra,
        }),
      ],
    }),
    problems: () => ['items.tsv line 3 (ok-a): the quote is 121 characters, and the limit is 120.'],
  },
  {
    title: 'an empty who',
    files: (ctx: TestContext) => ({
      items: [ctx.taskRow, buildHandKeptItemRow({ id: 'w-a', kind: 'wait', extra: 'who=' })],
    }),
    problems: () => ['items.tsv line 3 (w-a): the who is empty.'],
  },
  {
    title: 'a who over its limit',
    files: (ctx: TestContext) => ({
      items: [
        ctx.taskRow,
        buildHandKeptItemRow({ id: 'w-a', kind: 'wait', extra: `who=${'w'.repeat(17)}` }),
      ],
    }),
    problems: () => ['items.tsv line 3 (w-a): the who is 17 characters, and the limit is 16.'],
  },
  {
    title: 'a scope over its limit',
    files: (ctx: TestContext) => ({
      items: [
        ctx.taskRow,
        buildHandKeptItemRow({
          id: 'ok-a',
          kind: 'ok',
          extra: `who=owner;where=chat;scope=${'s'.repeat(41)};once`,
        }),
      ],
    }),
    problems: () => ['items.tsv line 3 (ok-a): the scope is 41 characters, and the limit is 40.'],
  },
  {
    title: 'an extra value that holds an equals sign',
    files: (ctx: TestContext) => ({
      items: [ctx.taskRow, buildHandKeptItemRow({ extra: 'scope=a=b' })],
    }),
    problems: () => [
      'items.tsv line 3 (t-b): the scope holds "=", and an extra value never holds ; or =.',
    ],
  },
  {
    title: 'an extra token that is not key=value',
    files: (ctx: TestContext) => ({
      items: [ctx.taskRow, buildHandKeptItemRow({ extra: 'whatever' })],
    }),
    problems: () => [
      'items.tsv line 3 (t-b): the extra token "whatever" is not key=value, once or standing.',
    ],
  },
  {
    title: 'an extra token of 50 characters, cut to 40',
    files: (ctx: TestContext) => ({
      items: [ctx.taskRow, buildHandKeptItemRow({ extra: 'x'.repeat(50) })],
    }),
    problems: () => [
      `items.tsv line 3 (t-b): the extra token "${'x'.repeat(40)}…" is not key=value, once or standing.`,
    ],
  },
  {
    title: 'an extra key that format 1 does not have',
    files: (ctx: TestContext) => ({
      items: [ctx.taskRow, buildHandKeptItemRow({ extra: 'colour=red' })],
    }),
    problems: () => [
      'items.tsv line 3 (t-b): the extra key colour is not who, where, scope, use, blocked_by or pid_start.',
    ],
  },
  {
    title: 'a use that is not once or standing',
    files: (ctx: TestContext) => ({
      items: [
        ctx.taskRow,
        buildHandKeptItemRow({
          id: 'ok-a',
          kind: 'ok',
          extra: 'who=owner;where=chat;scope=repo;use=always',
        }),
      ],
    }),
    problems: () => ['items.tsv line 3 (ok-a): the use always is not once or standing.'],
  },
  {
    title: 'an extra key given twice',
    files: (ctx: TestContext) => ({
      items: [ctx.taskRow, buildHandKeptItemRow({ extra: 'who=a;who=b' })],
    }),
    problems: () => ['items.tsv line 3 (t-b): the extra key who is given twice.'],
  },
  {
    title: 'a bare once and a use=standing',
    files: (ctx: TestContext) => ({
      items: [
        ctx.taskRow,
        buildHandKeptItemRow({
          id: 'ok-a',
          kind: 'ok',
          extra: 'who=owner;where=chat;scope=repo;once;use=standing',
        }),
      ],
    }),
    problems: () => ['items.tsv line 3 (ok-a): the extra key use is given twice.'],
  },
  {
    title: 'an approval with no where, scope or use',
    files: (ctx: TestContext) => ({
      items: [ctx.taskRow, buildHandKeptItemRow({ id: 'ok-a', kind: 'ok', extra: 'who=owner' })],
    }),
    problems: () => [
      'items.tsv line 3 (ok-a): an approval needs who, where, scope, and once or standing.',
    ],
  },
  {
    title: 'a wait with no who',
    files: (ctx: TestContext) => ({
      items: [ctx.taskRow, buildHandKeptItemRow({ id: 'w-a', kind: 'wait' })],
    }),
    problems: () => ['items.tsv line 3 (w-a): a wait needs who.'],
  },
  {
    title: 'a blocked_by that names no item',
    files: (ctx: TestContext) => ({
      items: [ctx.taskRow, buildHandKeptItemRow({ extra: 'blocked_by=t-gone' })],
    }),
    problems: () => ['items.tsv line 3 (t-b): blocked_by=t-gone names no open task or wait.'],
  },
  {
    title: 'a blocked_by that names an approval',
    files: (ctx: TestContext) => ({
      items: [
        ctx.taskRow,
        buildHandKeptItemRow({ id: 'ok-a', kind: 'ok', extra: ctx.approvalExtra }),
        buildHandKeptItemRow({ extra: 'blocked_by=ok-a' }),
      ],
    }),
    problems: () => ['items.tsv line 4 (t-b): blocked_by=ok-a names no open task or wait.'],
  },
  {
    title: 'a blocked_by that names a task a done row closed',
    files: (ctx: TestContext) => ({
      items: [
        ctx.taskRow,
        buildHandKeptItemRow({ id: 't-old' }),
        buildHandKeptItemRow({ extra: 'blocked_by=t-old' }),
      ],
      journal: [ctx.initRow, '2026-03-02T10:00:00Z\tdone\tt-old\tfinished'],
    }),
    problems: () => ['items.tsv line 4 (t-b): blocked_by=t-old names no open task or wait.'],
  },
  {
    title: 'a claim that looks like a credential',
    files: (ctx: TestContext) => ({
      items: [ctx.taskRow, buildHandKeptItemRow({ claim: `token AKIA${'Q'.repeat(16)}` })],
    }),
    problems: () => ['items.tsv line 3 (t-b): the text looks like a credential (it matches AKIA).'],
  },
  {
    title: 'an items row with a carriage return',
    files: (ctx: TestContext) => ({ items: [ctx.taskRow, buildHandKeptItemRow({ extra: '-\r' })] }),
    problems: () => [
      'items.tsv line 3 (t-b): the row holds a carriage return. Save the file with LF line endings.',
    ],
  },
  {
    title: 'an items row that breaks two rules, which gets one line',
    files: (ctx: TestContext) => ({
      items: [ctx.taskRow, buildHandKeptItemRow({ kind: 'epic', by: 'robot' })],
    }),
    problems: () => [
      'items.tsv line 3 (t-b): the kind epic is not task, wait, ok, rule or where.; by is robot, and it must be agent, owner or import.',
    ],
  },
  {
    title: 'a journal row with 3 columns',
    files: (ctx: TestContext) => ({ journal: [ctx.initRow, '2026-03-02T09:00:00Z\tnote\tn-1'] }),
    problems: () => [
      'journal.tsv line 3: the row has 3 columns, and a hand-kept journal row has 4.',
    ],
  },
  {
    title: 'an empty question',
    files: (ctx: TestContext) => ({
      journal: [
        ctx.initRow,
        buildHandKeptQuestionRow({ ts: '2026-03-02T10:01:00Z', id: 'q-1', text: '' }),
      ],
    }),
    problems: () => ['journal.tsv line 3 (q-1): the question is empty.'],
  },
  {
    title: 'a question over its limit',
    files: (ctx: TestContext) => ({
      journal: [ctx.initRow, buildHandKeptQuestionRow({ id: 'q-1', text: 'q'.repeat(121) })],
    }),
    problems: () => [
      'journal.tsv line 3 (q-1): the question is 121 characters, and the limit is 120 for a wait.',
    ],
  },
  {
    title: 'a question whose id breaks the id rule',
    files: (ctx: TestContext) => ({
      journal: [
        ctx.initRow,
        buildHandKeptQuestionRow({ ts: '2026-03-02T10:01:00Z', id: 'Q 1', text: 'Which one' }),
      ],
    }),
    problems: (ctx: TestContext) => [`journal.tsv line 3 (Q 1): ${ctx.idRule}`],
  },
  {
    title: 'a question with the id of an item',
    files: (ctx: TestContext) => ({
      journal: [
        ctx.initRow,
        buildHandKeptQuestionRow({ ts: '2026-03-02T10:01:00Z', id: 't-a', text: 'Which one' }),
      ],
    }),
    problems: () => ['journal.tsv line 3 (t-a): items.tsv line 2 has the same id.'],
  },
  {
    title: 'two open questions with one id',
    files: (ctx: TestContext) => ({
      journal: [
        ctx.initRow,
        buildHandKeptQuestionRow({ ts: '2026-03-02T10:01:00Z', id: 'q-1', text: 'Which one' }),
        buildHandKeptQuestionRow({ ts: '2026-03-02T10:02:00Z', id: 'q-1', text: 'Again' }),
      ],
    }),
    problems: () => ['journal.tsv line 4 (q-1): line 3 has the same id.'],
  },
  {
    title: 'a journal text that looks like a credential',
    files: (ctx: TestContext) => ({
      journal: [ctx.initRow, `2026-03-02T09:00:00Z\tnote\tn-1\ttoken AKIA${'Q'.repeat(16)}`],
    }),
    problems: () => [
      'journal.tsv line 3 (n-1): the text looks like a credential (it matches AKIA).',
    ],
  },
  {
    title: 'a journal row with a carriage return',
    files: (ctx: TestContext) => ({
      journal: [ctx.initRow, '2026-03-02T09:00:00Z\tnote\tn-1\tfine\r'],
    }),
    problems: () => [
      'journal.tsv line 3 (n-1): the row holds a carriage return. Save the file with LF line endings.',
    ],
  },
  {
    title: 'seven tasks against a cap of 6',
    files: () => ({
      items: ['t-a', 't-b', 't-c', 't-d', 't-e', 't-f', 't-g'].map((id) =>
        buildHandKeptItemRow({ id }),
      ),
    }),
    problems: (ctx: TestContext) => [
      `items.tsv: 7 open tasks (t-a, t-b, t-c, t-d, t-e, t-f, t-g), and the limit is 6. ${ctx.closeHint}`,
    ],
  },
  {
    title: 'five questions against a cap of 4 waits',
    files: () => ({
      journal: ['q-1', 'q-2', 'q-3', 'q-4', 'q-5'].map((id) =>
        buildHandKeptQuestionRow({ id, text: 'Which' }),
      ),
    }),
    problems: (ctx: TestContext) => [
      `journal.tsv: 5 open waits (q-1, q-2, q-3, q-4, q-5), and the limit is 4. ${ctx.closeHint}`,
    ],
  },
  {
    title: 'three wait items and two questions against a cap of 4 waits',
    files: (ctx: TestContext) => ({
      items: [
        ctx.taskRow,
        ...['w-a', 'w-b', 'w-c'].map((id) =>
          buildHandKeptItemRow({ id, kind: 'wait', extra: 'who=owner' }),
        ),
      ],
      journal: ['q-1', 'q-2'].map((id) => buildHandKeptQuestionRow({ id, text: 'Which' })),
    }),
    problems: (ctx: TestContext) => [
      `items.tsv and journal.tsv: 5 open waits (w-a, w-b, w-c, q-1, q-2), and the limit is 4. ${ctx.closeHint}`,
    ],
  },
  {
    title: 'four approvals against a cap of 3',
    files: (ctx: TestContext) => ({
      items: [
        ctx.taskRow,
        ...['ok-a', 'ok-b', 'ok-c', 'ok-d'].map((id) =>
          buildHandKeptItemRow({ id, kind: 'ok', extra: ctx.approvalExtra }),
        ),
      ],
    }),
    problems: (ctx: TestContext) => [
      `items.tsv: 4 open approvals (ok-a, ok-b, ok-c, ok-d), and the limit is 3. ${ctx.closeHint}`,
    ],
  },
  {
    title: 'six rules against a cap of 5',
    files: (ctx: TestContext) => ({
      items: [
        ctx.taskRow,
        ...['r-a', 'r-b', 'r-c', 'r-d', 'r-e', 'r-f'].map((id) =>
          buildHandKeptItemRow({ id, kind: 'rule' }),
        ),
      ],
    }),
    problems: (ctx: TestContext) => [
      `items.tsv: 6 open rules (r-a, r-b, r-c, r-d, r-e, r-f), and the limit is 5. ${ctx.closeHint}`,
    ],
  },
  {
    title: 'five where items against a cap of 4',
    files: (ctx: TestContext) => ({
      items: [
        ctx.taskRow,
        ...['wh-a', 'wh-b', 'wh-c', 'wh-d', 'wh-e'].map((id) =>
          buildHandKeptItemRow({ id, kind: 'where' }),
        ),
      ],
    }),
    problems: (ctx: TestContext) => [
      `items.tsv: 5 open where items (wh-a, wh-b, wh-c, wh-d, wh-e), and the limit is 4. ${ctx.closeHint}`,
    ],
  },
  {
    title: 'a session line, an items row, a journal row and two caps, in that order',
    files: (ctx: TestContext) => ({
      session: `${ctx.sessionText}bogus\n`,
      items: [
        ...['t-a', 't-b', 't-c', 't-d', 't-e', 't-f', 't-g'].map((id) =>
          buildHandKeptItemRow({ id }),
        ),
        buildHandKeptItemRow({ id: 'ok-a', kind: 'ok' }),
      ],
      journal: [
        ctx.initRow,
        '2026-03-02T09:00:00Z\tnote\tn-1',
        ...['q-1', 'q-2', 'q-3', 'q-4', 'q-5'].map((id) =>
          buildHandKeptQuestionRow({ id, text: 'Which' }),
        ),
      ],
    }),
    problems: (ctx: TestContext) => [
      'session line 8: the line is not key=value.',
      'items.tsv line 9 (ok-a): an approval needs who, where, scope, and once or standing.',
      'journal.tsv line 3: the row has 3 columns, and a hand-kept journal row has 4.',
      `items.tsv: 7 open tasks (t-a, t-b, t-c, t-d, t-e, t-f, t-g), and the limit is 6. ${ctx.closeHint}`,
      `journal.tsv: 5 open waits (q-1, q-2, q-3, q-4, q-5), and the limit is 4. ${ctx.closeHint}`,
    ],
  },
  {
    title: 'a closed item with a bad kind and a short row, where only the column count is checked',
    files: (ctx: TestContext) => ({
      items: [ctx.taskRow, 't-old\tepic\t-\t-\t-\t-\t-\trobot\t-', 't-short\ttask'],
      journal: [ctx.initRow, '2026-03-02T10:00:00Z\tdone\tt-old\tfinished'],
    }),
    problems: () => ['items.tsv line 4: the row has 2 columns, and items.tsv has 9.'],
  },
])('it refuses $title, with the exact problem lines', (row) => {
  const ctx = setupTest();

  expect(ctx.pick(row.files(ctx))).toStrictEqual({ kind: 'refused', problems: row.problems(ctx) });
});

test('it imports a session that holds lines import replaces', () => {
  const ctx = setupTest();

  const result = ctx.pick({
    session: `${ctx.sessionText}last_write=2026-03-01T00:00:00Z\nlast_nudge=x\nimported_from=0-by-hand\n`,
  });

  expect(result.kind).toBe('import');
});

test.each([
  {
    title: 'a decide row with a reason',
    files: () => ({ journal: ['2026-03-02T10:00:00Z\tdecide\td-1\tUse A | why: it is faster'] }),
    carried: () => [
      buildMockJournalRow({
        ts: '2026-03-02T10:00:00Z',
        by: 'import',
        op: 'decide',
        id: 'd-1',
        text: 'Use A',
        why: 'it is faster',
        extra: null,
      }),
    ],
  },
  {
    title: 'a decide row with no separator',
    files: () => ({ journal: ['2026-03-02T10:00:00Z\tdecide\td-1\tUse A. Why: it is faster'] }),
    carried: () => [
      buildMockJournalRow({
        ts: '2026-03-02T10:00:00Z',
        by: 'import',
        op: 'decide',
        id: 'd-1',
        text: 'Use A. Why: it is faster',
        why: null,
        extra: null,
      }),
    ],
  },
  {
    title: 'a decide row with an empty reason',
    files: () => ({ journal: ['2026-03-02T10:00:00Z\tdecide\td-1\tUse A | why: '] }),
    carried: () => [
      buildMockJournalRow({
        ts: '2026-03-02T10:00:00Z',
        by: 'import',
        op: 'decide',
        id: 'd-1',
        text: 'Use A',
        why: null,
        extra: null,
      }),
    ],
  },
  {
    title: 'a decide row that splits at the first separator only',
    files: () => ({ journal: ['2026-03-02T10:00:00Z\tdecide\td-1\tA | why: b | why: c'] }),
    carried: () => [
      buildMockJournalRow({
        ts: '2026-03-02T10:00:00Z',
        by: 'import',
        op: 'decide',
        id: 'd-1',
        text: 'A',
        why: 'b | why: c',
        extra: null,
      }),
    ],
  },
  {
    title: 'an open question that nothing settles',
    files: () => ({ journal: ['2026-03-02T10:00:00Z\topen\tq-1\tWhich kilns'] }),
    carried: () => [
      buildMockJournalRow({
        ts: '2026-03-02T10:00:00Z',
        by: 'import',
        op: 'wait',
        id: 'q-1',
        text: 'Which kilns',
        why: null,
        extra: 'who=owner',
      }),
    ],
  },
  {
    title: 'a closed row for a question',
    files: () => ({
      journal: [
        '2026-03-02T09:00:00Z\topen\tq-1\tWhich kilns',
        '2026-03-02T10:00:00Z\tclosed\tq-1\tAll of them',
      ],
    }),
    carried: () => [
      {
        ...buildMockJournalRow({
          ts: '2026-03-02T10:00:00Z',
          by: 'import',
          op: 'wait',
          id: 'q-1',
          text: 'Which kilns',
          why: null,
          extra: 'who=owner',
        }),
        ts: '2026-03-02T09:00:00Z',
      },
      buildMockJournalRow({
        ts: '2026-03-02T10:00:00Z',
        by: 'import',
        op: 'done',
        id: 'q-1',
        text: 'Which kilns',
        why: 'All of them',
        extra: null,
      }),
    ],
  },
  {
    title: 'a closed row for an item, with no text',
    files: (ctx: TestContext) => ({
      session: ctx.sessionText.replace('now=t-a', 'now='),
      journal: ['2026-03-02T10:00:00Z\tclosed\tt-a\t'],
    }),
    carried: () => [
      buildMockJournalRow({
        ts: '2026-03-02T10:00:00Z',
        by: 'import',
        op: 'done',
        id: 't-a',
        text: 'Write it',
        why: null,
        extra: null,
      }),
    ],
  },
  {
    title: 'a closed row that names neither an item nor a question',
    files: () => ({ journal: ['2026-03-02T10:00:00Z\tclosed\tq-9\tNo longer needed'] }),
    carried: () => [
      buildMockJournalRow({
        ts: '2026-03-02T10:00:00Z',
        by: 'import',
        op: 'done',
        id: 'q-9',
        text: null,
        why: 'No longer needed',
        extra: null,
      }),
    ],
  },
  {
    title: 'a done row for an id that is no item',
    files: () => ({ journal: ['2026-03-02T10:00:00Z\tdone\tt-ghost\tshipped'] }),
    carried: () => [
      buildMockJournalRow({
        ts: '2026-03-02T10:00:00Z',
        by: 'import',
        op: 'done',
        id: 't-ghost',
        text: 'shipped',
        why: null,
        extra: null,
      }),
    ],
  },
  {
    title: 'a say row, kept as history',
    files: () => ({ journal: ['2026-03-02T10:00:00Z\tsay\to-1\towner: keep it short'] }),
    carried: () => [
      buildMockJournalRow({
        ts: '2026-03-02T10:00:00Z',
        by: 'import',
        op: 'say',
        id: 'o-1',
        text: 'owner: keep it short',
        why: null,
        extra: null,
      }),
    ],
  },
  {
    title: 'a note row with a lone dash as its text',
    files: () => ({ journal: ['2026-03-02T10:00:00Z\tnote\tn-1\t-'] }),
    carried: () => [
      buildMockJournalRow({
        ts: '2026-03-02T10:00:00Z',
        by: 'import',
        op: 'note',
        id: 'n-1',
        text: null,
        why: null,
        extra: null,
      }),
    ],
  },
  {
    title: 'an op that is none of the known ones',
    files: () => ({ journal: ['2026-03-02T10:00:00Z\tweird\tx-1\tsomething'] }),
    carried: () => [
      buildMockJournalRow({
        ts: '2026-03-02T10:00:00Z',
        by: 'import',
        op: 'weird',
        id: 'x-1',
        text: 'something',
        why: null,
        extra: null,
      }),
    ],
  },
])('it carries over $title', (row) => {
  const ctx = setupTest();
  const result = ctx.pick(row.files(ctx));
  const carried = result.kind === 'import' ? result.journal.slice(0, -2) : null;

  expect(carried).toStrictEqual([...row.carried()]);
});

test.each([
  {
    title: 'a bare once',
    extra: 'who=owner;where=chat;scope=the repo;once',
    expected: { who: 'owner', where: 'chat', scope: 'the repo', use: 'once' },
  },
  {
    title: 'a bare standing',
    extra: 'standing;who=owner;where=chat;scope=the repo',
    expected: { who: 'owner', where: 'chat', scope: 'the repo', use: 'standing' },
  },
  {
    title: 'a use= pair',
    extra: 'use=once;scope=the repo;where=chat;who=owner',
    expected: { who: 'owner', where: 'chat', scope: 'the repo', use: 'once' },
  },
])('it converts an approval with $title', (row) => {
  const ctx = setupTest();

  const result = ctx.pick({
    items: [ctx.taskRow, buildHandKeptItemRow({ id: 'ok-a', kind: 'ok', extra: row.extra })],
  });

  const extra = result.kind === 'import' ? result.items[1]?.extra : null;

  expect(extra).toStrictEqual(row.expected);
});

test('it converts a whole store as store.md says, and leaves a closed item out', () => {
  const ctx = setupTest();

  const result = ctx.pick({
    session: `${ctx.sessionText}last_write=2026-01-01T00:00:00Z\n`,
    items: [
      ctx.taskRow,
      buildHandKeptItemRow({ id: 't-old', claim: 'Old work' }),
      buildHandKeptItemRow({ id: 'w-a', kind: 'wait', extra: 'who=vendor' }),
    ],
    journal: [
      ctx.initRow,
      '2026-03-04T10:00:00Z\tdone\tt-old\tmerged',
      buildHandKeptQuestionRow({
        ts: '2026-03-02T10:05:00Z',
        id: 'q-1',
        text: 'Which kilns first',
      }),
      '2026-03-03T10:00:00Z\tnote\tn-1\tPORT=8091',
    ],
  });

  expect(result).toStrictEqual({
    kind: 'import',
    session: {
      format: '1',
      name: 'old-notes',
      goal: 'Ship it',
      started: '2026-03-02T08:00:00Z',
      now: 't-a',
      nowNext: 'go',
      nowSet: '2026-03-02T09:30:00Z',
      lastWrite: '2026-03-04T10:00:00Z',
      lastNudge: null,
      importedFrom: '0-by-hand',
    },
    items: [
      {
        id: 't-a',
        kind: 'task',
        claim: 'Write it',
        check: null,
        atWrite: null,
        last: null,
        written: '2026-03-02T09:00:00Z',
        by: 'agent',
        extra: {},
      },
      {
        id: 'w-a',
        kind: 'wait',
        claim: 'Another',
        check: null,
        atWrite: null,
        last: null,
        written: '2026-03-02T09:00:00Z',
        by: 'agent',
        extra: { who: 'vendor' },
      },
      {
        id: 'q-1',
        kind: 'wait',
        claim: 'Which kilns first',
        check: null,
        atWrite: null,
        last: null,
        written: '2026-03-02T10:05:00Z',
        by: 'import',
        extra: { who: 'owner' },
      },
    ],
    carried: 4,
    journal: [
      {
        ...buildMockJournalRow({
          ts: '2026-03-02T10:00:00Z',
          by: 'import',
          op: 'init',
          id: 'old-notes',
          text: 'Start',
          why: null,
          extra: null,
        }),
        ts: '2026-03-02T08:00:00Z',
      },
      {
        ...buildMockJournalRow({
          ts: '2026-03-02T10:00:00Z',
          by: 'import',
          op: 'done',
          id: 't-old',
          text: 'merged',
          why: null,
          extra: null,
        }),
        ts: '2026-03-04T10:00:00Z',
      },
      {
        ...buildMockJournalRow({
          ts: '2026-03-02T10:00:00Z',
          by: 'import',
          op: 'wait',
          id: 'q-1',
          text: 'Which kilns first',
          why: null,
          extra: 'who=owner',
        }),
        ts: '2026-03-02T10:05:00Z',
      },
      {
        ...buildMockJournalRow({
          ts: '2026-03-02T10:00:00Z',
          by: 'import',
          op: 'note',
          id: 'n-1',
          text: 'PORT=8091',
          why: null,
          extra: null,
        }),
        ts: '2026-03-03T10:00:00Z',
      },
      {
        ts: '2026-03-10T11:43:00Z',
        op: 'import',
        id: 'old-notes',
        by: 'agent',
        text: '0-by-hand -> 1',
        why: null,
        extra: null,
      },
      {
        ts: '2026-03-10T11:43:00Z',
        op: 'bind',
        id: 'old-notes',
        by: 'agent',
        text: 'import',
        why: null,
        extra: 'harness=claude;agent=a1b2-test',
      },
    ],
  });
});

test('it ends the journal with the import row alone when there is no agent id', () => {
  const ctx = setupTest();
  const result = ctx.pick({}, false);
  const ops = result.kind === 'import' ? result.journal.map((row) => row.op) : null;

  expect(ops).toStrictEqual(['init', 'import']);
});

test('it converts a store with no journal rows, with an empty last_write', () => {
  const ctx = setupTest();
  const result = ctx.pick({ journal: [] });
  const lastWrite = result.kind === 'import' ? result.session.lastWrite : 'refused';

  expect(lastWrite).toBeNull();
});

test('it converts into files that the store parsers read back whole', () => {
  const ctx = setupTest();

  const result = ctx.pick({
    items: [
      ctx.taskRow,
      buildHandKeptItemRow({ id: 'ok-a', kind: 'ok', extra: ctx.approvalExtra }),
      buildHandKeptItemRow({ id: 'w-a', kind: 'wait', extra: 'who=vendor' }),
    ],
    journal: [
      ctx.initRow,
      '2026-03-02T10:00:00Z\tdecide\td-1\tUse A | why: faster',
      buildHandKeptQuestionRow({
        ts: '2026-03-02T10:05:00Z',
        id: 'q-1',
        text: 'Which kilns first',
      }),
      '2026-03-02T11:00:00Z\tnote\tn-1\t-',
    ],
  });

  const written =
    result.kind === 'import'
      ? {
          session: formatSessionFile(result.session),
          items: formatItemsFile(result.items),
          journal: formatJournalRows(result.journal),
          journalRows: result.journal.length,
        }
      : null;

  const parsedItems = parseItemsFile(written?.items ?? '');
  const parsedSession = parseSessionFile(written?.session ?? '');
  const parsedJournal = parseJournalFile(`${ctx.formatOneHead}\n${written?.journal ?? ''}`);

  const reformatted =
    written === null
      ? null
      : {
          session: parsedSession.kind === 'session' ? formatSessionFile(parsedSession.session) : '',
          items: parsedItems.kind === 'items' ? formatItemsFile(parsedItems.items) : '',
          journal: formatJournalRows(parsedJournal),
          journalRows: parsedJournal.length,
        };

  expect(reformatted).toStrictEqual(written);
});
