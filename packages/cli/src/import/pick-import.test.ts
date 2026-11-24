import { expect, test } from 'bun:test';
import { toPlaceholder } from '../refusals/to-placeholder.ts';
import { formatItemsFile } from '../store/format-items-file.ts';
import { formatJournalRows } from '../store/format-journal-rows.ts';
import { formatSessionFile } from '../store/format-session-file.ts';
import { parseItemsFile } from '../store/parse-items-file.ts';
import { parseJournalFile } from '../store/parse-journal-file.ts';
import { parseSessionFile } from '../store/parse-session-file.ts';
import { buildHandKeptApprovals } from '../test-utils/build-hand-kept-approvals.ts';
import { buildHandKeptItemRow } from '../test-utils/build-hand-kept-item-row.ts';
import { buildHandKeptQuestionRow } from '../test-utils/build-hand-kept-question-row.ts';
import { buildMockIDs } from '../test-utils/build-mock-ids.ts';
import { buildParsedArgs } from '../test-utils/build-parsed-args.ts';
import { buildRowsRefusal } from '../test-utils/build-rows-refusal.ts';
import { getPickedImport } from '../test-utils/get-picked-import.ts';
import { parseHandKeptStore } from './parse-hand-kept-store.ts';
import { pickImport } from './pick-import.ts';

test.each([
  {
    title: 'a session line that is not key=value',
    session: 'name=old-notes\ngoal=Ship it\nstarted=2026-03-02T08:00:00Z\nbogus\n',
    problems: ['session line 4: the line is not key=value.'],
  },
  {
    title: 'a session line that is not key=value and ends in a carriage return, on one line',
    session: 'name=old-notes\ngoal=Ship it\nstarted=2026-03-02T08:00:00Z\nbogus\r\n',
    problems: [
      'session line 4: the line is not key=value.; the line holds a carriage return. Save the file with LF line endings.',
    ],
  },
  {
    title: 'a session line with a carriage return',
    session: 'name=old-notes\r\ngoal=Ship it\nstarted=2026-03-02T08:00:00Z\n',
    problems: [
      'session line 1: the line holds a carriage return. Save the file with LF line endings.',
    ],
  },
  {
    title: 'a session with no goal',
    session: 'name=old-notes\nstarted=2026-03-02T08:00:00Z\n',
    problems: ['session (goal): the key is missing.'],
  },
  {
    title: 'a session whose goal is empty',
    session: 'name=old-notes\ngoal=\nstarted=2026-03-02T08:00:00Z\n',
    problems: ['session (goal): the key is missing.'],
  },
  {
    title: 'a session whose name is not the folder name',
    session: 'name=other-notes\ngoal=Ship it\nstarted=2026-03-02T08:00:00Z\n',
    problems: ['session (name): the name other-notes is not the folder name old-notes.'],
  },
  {
    title: 'a session key that format 1 does not have',
    session: 'name=old-notes\ngoal=Ship it\nstarted=2026-03-02T08:00:00Z\ncolour=red\n',
    problems: ['session (colour): format 1 has no key colour. Remove the line.'],
  },
  {
    title: 'a goal over its limit',
    session: `name=old-notes\ngoal=${'g'.repeat(201)}\nstarted=2026-03-02T08:00:00Z\n`,
    problems: ['session (goal): the goal is 201 characters, and the limit is 200.'],
  },
  {
    title: 'a goal with a tab',
    session: 'name=old-notes\ngoal=Ship\tit\nstarted=2026-03-02T08:00:00Z\n',
    problems: ['session (goal): the text must be one line, with no tab or newline.'],
  },
  {
    title: 'a goal with a tab that ends in a carriage return, on one line',
    session: 'name=old-notes\ngoal=Ship\tit\r\nstarted=2026-03-02T08:00:00Z\n',
    problems: [
      'session (goal): the text must be one line, with no tab or newline.; the line holds a carriage return. Save the file with LF line endings.',
    ],
  },
  {
    title: 'a next step over its limit',
    session: `name=old-notes\ngoal=Ship it\nstarted=2026-03-02T08:00:00Z\nnow_next=${'n'.repeat(121)}\n`,
    problems: ['session (now_next): the next step is 121 characters, and the limit is 120.'],
  },
  {
    title: 'a next step with a tab',
    session: 'name=old-notes\ngoal=Ship it\nstarted=2026-03-02T08:00:00Z\nnow_next=go\tnow\n',
    problems: ['session (now_next): the text must be one line, with no tab or newline.'],
  },
  {
    title: 'a goal that looks like a credential',
    session: `name=old-notes\ngoal=key AKIA${'Q'.repeat(16)}\nstarted=2026-03-02T08:00:00Z\n`,
    problems: ['session (goal): the text looks like a credential (it matches the AKIA pattern).'],
  },
  {
    title: 'a name that looks like a credential, which the line never prints',
    session: `name=AKIA${'Q'.repeat(16)}\ngoal=Ship it\nstarted=2026-03-02T08:00:00Z\n`,
    problems: [
      'session (name): the name <where the secret lives> is not the folder name old-notes.; the text looks like a credential (it matches the AKIA pattern).',
    ],
  },
  {
    title: 'a now that names no open item',
    session: 'name=old-notes\ngoal=Ship it\nstarted=2026-03-02T08:00:00Z\nnow=t-gone\n',
    problems: ['session (now): t-gone names no open item.'],
  },
])('it refuses $title, with the exact problem lines', (row) => {
  const hand = parseHandKeptStore({
    session: row.session,
    items:
      'id\tkind\tclaim\tcheck\tat_write\tlast\twritten\tby\textra\nt-a\ttask\tWrite it\t-\t-\t-\t2026-03-02T09:00:00Z\tagent\t-\n',
    journal: 'ts\top\tid\ttext\n2026-03-02T08:00:00Z\tinit\told-notes\tStart\n',
  });

  const picked = pickImport(hand, {
    name: 'old-notes',
    args: buildParsedArgs(['import', 'old-notes']),
    nowMs: Date.parse('2026-03-10T11:43:00Z'),
    byOwner: false,
    agent: null,
  });

  expect(picked).toStrictEqual(buildRowsRefusal(row.problems));
});

test.each([
  {
    title: 'an items row with 8 columns',
    items: ['t-a\ttask\tx\t-\t-\t-\t2026-03-02T09:00:00Z\tagent'],
    journal: [],
    problems: ['items.tsv line 2: the row has 8 columns, and items.tsv has 9.'],
  },
  {
    title: 'an item id with a capital',
    items: [buildHandKeptItemRow({ id: 'T-1' })],
    journal: [],
    problems: [
      'items.tsv line 2 (T-1): the id breaks the id rule: 2 to 16 characters of a-z, 0-9 and -, starting with a letter, and not grant, d-<n> or o-<n>.',
    ],
  },
  {
    title: 'an item id that a decision keeps',
    items: [buildHandKeptItemRow({ id: 'd-4' })],
    journal: [],
    problems: [
      'items.tsv line 2 (d-4): the id breaks the id rule: 2 to 16 characters of a-z, 0-9 and -, starting with a letter, and not grant, d-<n> or o-<n>.',
    ],
  },
  {
    title: 'the same id on two rows',
    items: [buildHandKeptItemRow({ id: 't-a' }), buildHandKeptItemRow({ id: 't-a' })],
    journal: [],
    problems: ['items.tsv line 3 (t-a): line 2 has the same id.'],
  },
  {
    title: 'a kind that is none of the five',
    items: [buildHandKeptItemRow({ kind: 'epic' })],
    journal: [],
    problems: ['items.tsv line 2 (t-b): the kind epic is not task, wait, ok, rule or where.'],
  },
  {
    title: 'a check that does not parse',
    items: [buildHandKeptItemRow({ check: 'pr:bad' })],
    journal: [],
    problems: ['items.tsv line 2 (t-b): the check pr:bad does not parse.'],
  },
  {
    title: 'a rule with a check',
    items: [buildHandKeptItemRow({ id: 'r-a', kind: 'rule', check: 'pid:5' })],
    journal: [],
    problems: ['items.tsv line 2 (r-a): a rule has no check.'],
  },
  {
    title: 'a by that is none of the three',
    items: [buildHandKeptItemRow({ by: 'robot' })],
    journal: [],
    problems: ['items.tsv line 2 (t-b): by is robot, and it must be agent, owner or import.'],
  },
  {
    title: 'an empty claim',
    items: [buildHandKeptItemRow({ claim: '' })],
    journal: [],
    problems: ['items.tsv line 2 (t-b): the claim is empty.'],
  },
  {
    title: 'a claim of one dash',
    items: [buildHandKeptItemRow({ claim: '-' })],
    journal: [],
    problems: ['items.tsv line 2 (t-b): the claim is empty.'],
  },
  {
    title: 'a claim over its limit',
    items: [buildHandKeptItemRow({ claim: 'c'.repeat(121) })],
    journal: [],
    problems: ['items.tsv line 2 (t-b): the claim is 121 characters, and the limit is 120.'],
  },
  {
    title: 'an approval quote over its limit',
    items: [
      buildHandKeptItemRow({
        id: 'ok-a',
        kind: 'ok',
        claim: 'q'.repeat(121),
        extra: 'who=owner;where=chat;scope=the repo;once',
      }),
    ],
    journal: [],
    problems: ['items.tsv line 2 (ok-a): the quote is 121 characters, and the limit is 120.'],
  },
  {
    title: 'an empty who',
    items: [buildHandKeptItemRow({ id: 'w-a', kind: 'wait', extra: 'who=' })],
    journal: [],
    problems: ['items.tsv line 2 (w-a): the who is empty.'],
  },
  {
    title: 'a who over its limit',
    items: [buildHandKeptItemRow({ id: 'w-a', kind: 'wait', extra: `who=${'w'.repeat(17)}` })],
    journal: [],
    problems: ['items.tsv line 2 (w-a): the who is 17 characters, and the limit is 16.'],
  },
  {
    title: 'a scope over its limit',
    items: [
      buildHandKeptItemRow({
        id: 'ok-a',
        kind: 'ok',
        extra: `who=owner;where=chat;scope=${'s'.repeat(41)};once`,
      }),
    ],
    journal: [],
    problems: ['items.tsv line 2 (ok-a): the scope is 41 characters, and the limit is 40.'],
  },
  {
    title: 'an extra value that holds an equals sign',
    items: [
      buildHandKeptItemRow({
        id: 'ok-a',
        kind: 'ok',
        extra: 'who=owner;where=chat;scope=a=b;once',
      }),
    ],
    journal: [],
    problems: [
      'items.tsv line 2 (ok-a): the scope holds "=", and an extra value never holds ; or =.; an approval needs who, where, scope, and once or standing.',
    ],
  },
  {
    title: 'an extra token that is not key=value',
    items: [buildHandKeptItemRow({ extra: 'whatever' })],
    journal: [],
    problems: [
      'items.tsv line 2 (t-b): the extra token "whatever" is not key=value, once or standing.',
    ],
  },
  {
    title: 'an extra token of 50 characters, cut to 40',
    items: [buildHandKeptItemRow({ extra: 'x'.repeat(50) })],
    journal: [],
    problems: [
      `items.tsv line 2 (t-b): the extra token "${'x'.repeat(40)}…" is not key=value, once or standing.`,
    ],
  },
  {
    title: 'an extra key that format 1 does not have',
    items: [buildHandKeptItemRow({ extra: 'colour=red' })],
    journal: [],
    problems: [
      'items.tsv line 2 (t-b): the extra key colour is not who, where, scope, use, blocked_by or pid_start.',
    ],
  },
  {
    title: 'a use that is not once or standing',
    items: [
      buildHandKeptItemRow({
        id: 'ok-a',
        kind: 'ok',
        extra: 'who=owner;where=chat;scope=repo;use=always',
      }),
    ],
    journal: [],
    problems: ['items.tsv line 2 (ok-a): the use always is not once or standing.'],
  },
  {
    title: 'an extra key given twice',
    items: [buildHandKeptItemRow({ id: 'w-a', kind: 'wait', extra: 'who=a;who=b' })],
    journal: [],
    problems: ['items.tsv line 2 (w-a): the extra key who is given twice.'],
  },
  {
    title: 'a bare once and a use=standing',
    items: [
      buildHandKeptItemRow({
        id: 'ok-a',
        kind: 'ok',
        extra: 'who=owner;where=chat;scope=repo;once;use=standing',
      }),
    ],
    journal: [],
    problems: ['items.tsv line 2 (ok-a): the extra key use is given twice.'],
  },
  {
    title: 'a task that holds use=once, which only an approval holds',
    items: [buildHandKeptItemRow({ kind: 'task', extra: 'once' })],
    journal: [],
    problems: [
      'items.tsv line 2 (t-b): the extra key use is for kind ok, and this row is kind task.',
    ],
  },
  {
    title: 'a wait that holds blocked_by, which only a task holds',
    items: [buildHandKeptItemRow({ id: 'w-a', kind: 'wait', extra: 'who=owner;blocked_by=w-a' })],
    journal: [],
    problems: [
      'items.tsv line 2 (w-a): the extra key blocked_by is for kind task, and this row is kind wait.',
    ],
  },
  {
    title: 'a pid_start on a row with no pid check',
    items: [buildHandKeptItemRow({ kind: 'task', check: '-', extra: 'pid_start=12345' })],
    journal: [],
    problems: [
      'items.tsv line 2 (t-b): the extra key pid_start is for a pid check, and this row has none.',
    ],
  },
  {
    title: 'an approval with no where, scope or use',
    items: [buildHandKeptItemRow({ id: 'ok-a', kind: 'ok', extra: 'who=owner' })],
    journal: [],
    problems: [
      'items.tsv line 2 (ok-a): an approval needs who, where, scope, and once or standing.',
    ],
  },
  {
    title: 'a wait with no who',
    items: [buildHandKeptItemRow({ id: 'w-a', kind: 'wait' })],
    journal: [],
    problems: ['items.tsv line 2 (w-a): a wait needs who.'],
  },
  {
    title: 'a blocked_by that names no item',
    items: [buildHandKeptItemRow({ kind: 'task', extra: 'blocked_by=t-gone' })],
    journal: [],
    problems: ['items.tsv line 2 (t-b): blocked_by=t-gone names no open task or wait.'],
  },
  {
    title: 'a blocked_by that names an approval',
    items: [
      buildHandKeptItemRow({
        id: 'ok-a',
        kind: 'ok',
        extra: 'who=owner;where=chat;scope=the repo;once',
      }),
      buildHandKeptItemRow({ kind: 'task', extra: 'blocked_by=ok-a' }),
    ],
    journal: [],
    problems: ['items.tsv line 3 (t-b): blocked_by=ok-a names no open task or wait.'],
  },
  {
    title: 'a blocked_by that names a task a done row closed',
    items: [
      buildHandKeptItemRow({ id: 't-old', kind: 'task' }),
      buildHandKeptItemRow({ kind: 'task', extra: 'blocked_by=t-old' }),
    ],
    journal: ['2026-03-02T10:00:00Z\tdone\tt-old\tfinished'],
    problems: ['items.tsv line 3 (t-b): blocked_by=t-old names no open task or wait.'],
  },
  {
    title: 'a claim that looks like a credential',
    items: [buildHandKeptItemRow({ claim: `token AKIA${'Q'.repeat(16)}` })],
    journal: [],
    problems: [
      'items.tsv line 2 (t-b): the text looks like a credential (it matches the AKIA pattern).',
    ],
  },
  {
    title: 'a check that looks like a credential, which the line never prints',
    items: [buildHandKeptItemRow({ check: `AKIA${'Q'.repeat(16)}` })],
    journal: [],
    problems: [
      'items.tsv line 2 (t-b): the check <where the secret lives> does not parse.; the text looks like a credential (it matches the AKIA pattern).',
    ],
  },
  {
    title: 'a stored check result that looks like a credential',
    items: [
      `t-b\ttask\tAnother\tpid:5\tOPEN AKIA${'Q'.repeat(16)}\t-\t2026-03-02T09:00:00Z\tagent\t-`,
    ],
    journal: [],
    problems: [
      'items.tsv line 2 (t-b): the text looks like a credential (it matches the AKIA pattern).',
    ],
  },
  {
    title: 'an item id that looks like a credential, which the line never prints',
    items: [buildHandKeptItemRow({ id: `AKIA${'Q'.repeat(16)}` })],
    journal: [],
    problems: [
      'items.tsv line 2 (<where the secret lives>): the id breaks the id rule: 2 to 16 characters of a-z, 0-9 and -, starting with a letter, and not grant, d-<n> or o-<n>.; the text looks like a credential (it matches the AKIA pattern).',
    ],
  },
  {
    title: 'an items row with a carriage return',
    items: [buildHandKeptItemRow({ extra: '-\r' })],
    journal: [],
    problems: [
      'items.tsv line 2 (t-b): the row holds a carriage return. Save the file with LF line endings.',
    ],
  },
  {
    title: 'an items row that breaks two rules, which gets one line',
    items: [buildHandKeptItemRow({ kind: 'epic', by: 'robot' })],
    journal: [],
    problems: [
      'items.tsv line 2 (t-b): the kind epic is not task, wait, ok, rule or where.; by is robot, and it must be agent, owner or import.',
    ],
  },
  {
    title: 'a closed item with a bad kind and a short row, where only the column count is checked',
    items: ['t-old\tepic\t-\t-\t-\t-\t-\trobot\t-', 't-short\ttask'],
    journal: ['2026-03-02T10:00:00Z\tdone\tt-old\tfinished'],
    problems: ['items.tsv line 3: the row has 2 columns, and items.tsv has 9.'],
  },
  {
    title: 'a closed row for an item whose claim looks like a credential',
    items: [buildHandKeptItemRow({ claim: `token AKIA${'Q'.repeat(16)}` })],
    journal: ['2026-03-02T10:00:00Z\tclosed\tt-b\tfinished'],
    problems: [
      'journal.tsv line 2 (t-b): the text looks like a credential (it matches the AKIA pattern).',
    ],
  },
  {
    title: 'a closed row for a question whose text looks like a credential',
    items: [],
    journal: [
      buildHandKeptQuestionRow({ id: 'q-1', text: `token AKIA${'Q'.repeat(16)}` }),
      '2026-03-02T10:00:00Z\tclosed\tq-1\tfinished',
    ],
    problems: [
      'journal.tsv line 2 (q-1): the text looks like a credential (it matches the AKIA pattern).',
      'journal.tsv line 3 (q-1): the text looks like a credential (it matches the AKIA pattern).',
    ],
  },
  {
    title: 'a journal row with 3 columns',
    items: [],
    journal: ['2026-03-02T09:00:00Z\tnote\tn-1'],
    problems: ['journal.tsv line 2: the row has 3 columns, and a hand-kept journal row has 4.'],
  },
  {
    title: 'an empty question',
    items: [],
    journal: [buildHandKeptQuestionRow({ id: 'q-1', text: '' })],
    problems: ['journal.tsv line 2 (q-1): the question is empty.'],
  },
  {
    title: 'a question over its limit',
    items: [],
    journal: [buildHandKeptQuestionRow({ id: 'q-1', text: 'q'.repeat(121) })],
    problems: [
      'journal.tsv line 2 (q-1): the question is 121 characters, and the limit is 120 for a wait.',
    ],
  },
  {
    title: 'a question whose id breaks the id rule',
    items: [],
    journal: [buildHandKeptQuestionRow({ id: 'Q 1', text: 'Which one' })],
    problems: [
      'journal.tsv line 2 (Q 1): the id breaks the id rule: 2 to 16 characters of a-z, 0-9 and -, starting with a letter, and not grant, d-<n> or o-<n>.',
    ],
  },
  {
    title: 'a question with the id of an item',
    items: [buildHandKeptItemRow({ id: 't-a' })],
    journal: [buildHandKeptQuestionRow({ id: 't-a', text: 'Which one' })],
    problems: ['journal.tsv line 2 (t-a): items.tsv line 2 has the same id.'],
  },
  {
    title: 'two open questions with one id',
    items: [],
    journal: [
      buildHandKeptQuestionRow({ id: 'q-1', text: 'Which one' }),
      buildHandKeptQuestionRow({ id: 'q-1', text: 'Again' }),
    ],
    problems: ['journal.tsv line 3 (q-1): line 2 has the same id.'],
  },
  {
    title: 'a question that reuses an id a closed row settled',
    items: [],
    journal: [
      buildHandKeptQuestionRow({ id: 'q-1', text: 'Which one' }),
      '2026-03-02T10:30:00Z\tclosed\tq-1\tAll of them',
      buildHandKeptQuestionRow({ id: 'q-1', text: 'Again' }),
    ],
    problems: ['journal.tsv line 4 (q-1): line 3 closed the id, and a closed id is never reused.'],
  },
  {
    title: 'a question that reuses an id a done row closed',
    items: [],
    journal: [
      '2026-03-02T09:00:00Z\tdone\tq-1\tshipped',
      buildHandKeptQuestionRow({ id: 'q-1', text: 'Again' }),
    ],
    problems: ['journal.tsv line 3 (q-1): line 2 closed the id, and a closed id is never reused.'],
  },
  {
    title: 'a question that reuses an id a done row closed, and a closed row closes again',
    items: [],
    journal: [
      '2026-03-02T09:00:00Z\tdone\tq-1\tshipped',
      buildHandKeptQuestionRow({ id: 'q-1', text: 'Again' }),
      '2026-03-02T10:30:00Z\tclosed\tq-1\tAll of them',
    ],
    problems: ['journal.tsv line 3 (q-1): line 2 closed the id, and a closed id is never reused.'],
  },
  {
    title: 'a journal text that looks like a credential',
    items: [],
    journal: [`2026-03-02T09:00:00Z\tnote\tn-1\ttoken AKIA${'Q'.repeat(16)}`],
    problems: [
      'journal.tsv line 2 (n-1): the text looks like a credential (it matches the AKIA pattern).',
    ],
  },
  {
    title: 'a journal row with a carriage return',
    items: [],
    journal: ['2026-03-02T09:00:00Z\tnote\tn-1\tfine\r'],
    problems: [
      'journal.tsv line 2 (n-1): the row holds a carriage return. Save the file with LF line endings.',
    ],
  },
  {
    title: '31 tasks against a cap of 30',
    items: buildMockIDs('t-', 31).map((id) => buildHandKeptItemRow({ id })),
    journal: [],
    problems: [
      `items.tsv: 31 open tasks (${buildMockIDs('t-', 31).join(', ')}), and the limit is 30. Close one by appending the tab-separated row: <ts> closed <id> <what settled it>`,
    ],
  },
  {
    title: 'nine questions against a cap of 8 waits',
    items: [],
    journal: buildMockIDs('q-', 9).map((id) => buildHandKeptQuestionRow({ id, text: 'Which' })),
    problems: [
      `journal.tsv: 9 open waits (${buildMockIDs('q-', 9).join(', ')}), and the limit is 8. Close one by appending the tab-separated row: <ts> closed <id> <what settled it>`,
    ],
  },
  {
    title: 'six wait items and three questions against a cap of 8 waits',
    items: buildMockIDs('w-', 6).map((id) =>
      buildHandKeptItemRow({ id, kind: 'wait', extra: 'who=owner' }),
    ),
    journal: buildMockIDs('q-', 3).map((id) => buildHandKeptQuestionRow({ id, text: 'Which' })),
    problems: [
      `items.tsv and journal.tsv: 9 open waits (${[...buildMockIDs('w-', 6), ...buildMockIDs('q-', 3)].join(', ')}), and the limit is 8. Close one by appending the tab-separated row: <ts> closed <id> <what settled it>`,
    ],
  },
  {
    title: '16 rules against a cap of 15',
    items: buildMockIDs('r-', 16).map((id) => buildHandKeptItemRow({ id, kind: 'rule' })),
    journal: [],
    problems: [
      `items.tsv: 16 open rules (${buildMockIDs('r-', 16).join(', ')}), and the limit is 15. Close one by appending the tab-separated row: <ts> closed <id> <what settled it>`,
    ],
  },
  {
    title: 'nine where items against a cap of 8',
    items: buildMockIDs('wh-', 9).map((id) => buildHandKeptItemRow({ id, kind: 'where' })),
    journal: [],
    problems: [
      `items.tsv: 9 open where items (${buildMockIDs('wh-', 9).join(', ')}), and the limit is 8. Close one by appending the tab-separated row: <ts> closed <id> <what settled it>`,
    ],
  },
  {
    title: 'a cap that counts an id that looks like a credential without printing it',
    items: [...buildMockIDs('t-', 30), `AKIA${'Q'.repeat(16)}`].map((id) =>
      buildHandKeptItemRow({ id }),
    ),
    journal: [],
    problems: [
      'items.tsv line 32 (<where the secret lives>): the id breaks the id rule: 2 to 16 characters of a-z, 0-9 and -, starting with a letter, and not grant, d-<n> or o-<n>.; the text looks like a credential (it matches the AKIA pattern).',
      `items.tsv: 31 open tasks (${buildMockIDs('t-', 30).join(', ')}, <where the secret lives>), and the limit is 30. Close one by appending the tab-separated row: <ts> closed <id> <what settled it>`,
    ],
  },
])('it refuses $title, with the exact problem lines', (row) => {
  const hand = parseHandKeptStore({
    session: 'name=old-notes\ngoal=Ship it\nstarted=2026-03-02T08:00:00Z\n',
    items: `${['id\tkind\tclaim\tcheck\tat_write\tlast\twritten\tby\textra', ...row.items].join('\n')}\n`,
    journal: `${['ts\top\tid\ttext', ...row.journal].join('\n')}\n`,
  });

  const picked = pickImport(hand, {
    name: 'old-notes',
    args: buildParsedArgs(['import', 'old-notes']),
    nowMs: Date.parse('2026-03-10T11:43:00Z'),
    byOwner: false,
    agent: null,
  });

  expect(picked).toStrictEqual(buildRowsRefusal(row.problems));
});

test.each([
  {
    title: 'a header of items.tsv that changed',
    items: 'id\tkind\tclaim\n',
    journal: 'ts\top\tid\ttext\n',
    problems: [
      'items.tsv line 1: the header is not id, kind, claim, check, at_write, last, written, by, extra.',
    ],
  },
  {
    title: 'a header of journal.tsv that changed',
    items: 'id\tkind\tclaim\tcheck\tat_write\tlast\twritten\tby\textra\n',
    journal: 'ts\top\n',
    problems: ['journal.tsv line 1: the header is not ts, op, id, text.'],
  },
  {
    title: 'a header of items.tsv with a carriage return',
    items: 'id\tkind\tclaim\tcheck\tat_write\tlast\twritten\tby\textra\r\n',
    journal: 'ts\top\tid\ttext\n',
    problems: [
      'items.tsv line 1: the row holds a carriage return. Save the file with LF line endings.',
    ],
  },
])('it refuses $title', (row) => {
  const hand = parseHandKeptStore({
    session: 'name=old-notes\ngoal=Ship it\nstarted=2026-03-02T08:00:00Z\n',
    items: row.items,
    journal: row.journal,
  });

  const picked = pickImport(hand, {
    name: 'old-notes',
    args: buildParsedArgs(['import', 'old-notes']),
    nowMs: Date.parse('2026-03-10T11:43:00Z'),
    byOwner: false,
    agent: null,
  });

  expect(picked).toStrictEqual(buildRowsRefusal(row.problems));
});

test('it refuses a now that names a task a done row closed', () => {
  const hand = parseHandKeptStore({
    session: 'name=old-notes\ngoal=Ship it\nstarted=2026-03-02T08:00:00Z\nnow=t-a\n',
    items:
      'id\tkind\tclaim\tcheck\tat_write\tlast\twritten\tby\textra\nt-a\ttask\tWrite it\t-\t-\t-\t2026-03-02T09:00:00Z\tagent\t-\n',
    journal: 'ts\top\tid\ttext\n2026-03-02T10:00:00Z\tdone\tt-a\tfinished\n',
  });

  const picked = pickImport(hand, {
    name: 'old-notes',
    args: buildParsedArgs(['import', 'old-notes']),
    nowMs: Date.parse('2026-03-10T11:43:00Z'),
    byOwner: false,
    agent: null,
  });

  expect(picked).toStrictEqual(buildRowsRefusal(['session (now): t-a names no open item.']));
});

test('it lists a session line, an items row, a journal row and two caps, in that order', () => {
  const hand = parseHandKeptStore({
    session: 'name=old-notes\ngoal=Ship it\nstarted=2026-03-02T08:00:00Z\nbogus\n',
    items: `${[
      'id\tkind\tclaim\tcheck\tat_write\tlast\twritten\tby\textra',
      ...buildMockIDs('t-', 31).map((id) => buildHandKeptItemRow({ id })),
      buildHandKeptItemRow({ id: 'ok-a', kind: 'ok' }),
    ].join('\n')}\n`,
    journal: `${[
      'ts\top\tid\ttext',
      '2026-03-02T09:00:00Z\tnote\tn-1',
      ...buildMockIDs('q-', 9).map((id) => buildHandKeptQuestionRow({ id, text: 'Which' })),
    ].join('\n')}\n`,
  });

  const picked = pickImport(hand, {
    name: 'old-notes',
    args: buildParsedArgs(['import', 'old-notes']),
    nowMs: Date.parse('2026-03-10T11:43:00Z'),
    byOwner: false,
    agent: null,
  });

  expect(picked).toStrictEqual(
    buildRowsRefusal([
      'session line 4: the line is not key=value.',
      'items.tsv line 33 (ok-a): an approval needs who, where, scope, and once or standing.',
      'journal.tsv line 2: the row has 3 columns, and a hand-kept journal row has 4.',
      `items.tsv: 31 open tasks (${buildMockIDs('t-', 31).join(', ')}), and the limit is 30. Close one by appending the tab-separated row: <ts> closed <id> <what settled it>`,
      `journal.tsv: 9 open waits (${buildMockIDs('q-', 9).join(', ')}), and the limit is 8. Close one by appending the tab-separated row: <ts> closed <id> <what settled it>`,
    ]),
  );
});

test('it imports a session that holds lines import replaces', () => {
  const hand = parseHandKeptStore({
    session:
      'name=old-notes\ngoal=Ship it\nstarted=2026-03-02T08:00:00Z\nlast_write=2026-03-01T00:00:00Z\nlast_nudge=x\nimported_from=0-by-hand\n',
    items: 'id\tkind\tclaim\tcheck\tat_write\tlast\twritten\tby\textra\n',
    journal: 'ts\top\tid\ttext\n',
  });

  const picked = pickImport(hand, {
    name: 'old-notes',
    args: buildParsedArgs(['import', 'old-notes']),
    nowMs: Date.parse('2026-03-10T11:43:00Z'),
    byOwner: false,
    agent: null,
  });

  expect(picked.kind).toStrictEqual('import');
});

test.each([
  {
    title: 'a decide row with a reason',
    journal: ['2026-03-02T10:00:00Z\tdecide\td-1\tUse A | why: it is faster'],
    carried: [
      {
        ts: '2026-03-02T10:00:00Z',
        op: 'decide',
        id: 'd-1',
        by: 'import',
        text: 'Use A',
        why: 'it is faster',
        extra: null,
      },
    ],
  },
  {
    title: 'a decide row with no separator',
    journal: ['2026-03-02T10:00:00Z\tdecide\td-1\tUse A. Why: it is faster'],
    carried: [
      {
        ts: '2026-03-02T10:00:00Z',
        op: 'decide',
        id: 'd-1',
        by: 'import',
        text: 'Use A. Why: it is faster',
        why: null,
        extra: null,
      },
    ],
  },
  {
    title: 'a decide row with an empty reason',
    journal: ['2026-03-02T10:00:00Z\tdecide\td-1\tUse A | why: '],
    carried: [
      {
        ts: '2026-03-02T10:00:00Z',
        op: 'decide',
        id: 'd-1',
        by: 'import',
        text: 'Use A',
        why: null,
        extra: null,
      },
    ],
  },
  {
    title: 'a decide row that splits at the first separator only',
    journal: ['2026-03-02T10:00:00Z\tdecide\td-1\tA | why: b | why: c'],
    carried: [
      {
        ts: '2026-03-02T10:00:00Z',
        op: 'decide',
        id: 'd-1',
        by: 'import',
        text: 'A',
        why: 'b | why: c',
        extra: null,
      },
    ],
  },
  {
    title: 'an open question that nothing settles',
    journal: ['2026-03-02T10:00:00Z\topen\tq-1\tWhich kilns'],
    carried: [
      {
        ts: '2026-03-02T10:00:00Z',
        op: 'wait',
        id: 'q-1',
        by: 'import',
        text: 'Which kilns',
        why: null,
        extra: 'who=owner',
      },
    ],
  },
  {
    title: 'a closed row for a question',
    journal: [
      '2026-03-02T09:00:00Z\topen\tq-1\tWhich kilns',
      '2026-03-02T10:00:00Z\tclosed\tq-1\tAll of them',
    ],
    carried: [
      {
        ts: '2026-03-02T09:00:00Z',
        op: 'wait',
        id: 'q-1',
        by: 'import',
        text: 'Which kilns',
        why: null,
        extra: 'who=owner',
      },
      {
        ts: '2026-03-02T10:00:00Z',
        op: 'done',
        id: 'q-1',
        by: 'import',
        text: 'Which kilns',
        why: 'All of them',
        extra: null,
      },
    ],
  },
  {
    title: 'a closed row for an item, with no text',
    journal: ['2026-03-02T10:00:00Z\tclosed\tt-a\t'],
    carried: [
      {
        ts: '2026-03-02T10:00:00Z',
        op: 'done',
        id: 't-a',
        by: 'import',
        text: 'Write it',
        why: null,
        extra: null,
      },
    ],
  },
  {
    title: 'a closed row that names neither an item nor a question',
    journal: ['2026-03-02T10:00:00Z\tclosed\tq-9\tNo longer needed'],
    carried: [
      {
        ts: '2026-03-02T10:00:00Z',
        op: 'done',
        id: 'q-9',
        by: 'import',
        text: null,
        why: 'No longer needed',
        extra: null,
      },
    ],
  },
  {
    title: 'a done row for an id that is no item',
    journal: ['2026-03-02T10:00:00Z\tdone\tt-ghost\tshipped'],
    carried: [
      {
        ts: '2026-03-02T10:00:00Z',
        op: 'done',
        id: 't-ghost',
        by: 'import',
        text: 'shipped',
        why: null,
        extra: null,
      },
    ],
  },
  {
    title: 'a say row, kept as history',
    journal: ['2026-03-02T10:00:00Z\tsay\to-1\towner: keep it short'],
    carried: [
      {
        ts: '2026-03-02T10:00:00Z',
        op: 'say',
        id: 'o-1',
        by: 'import',
        text: 'owner: keep it short',
        why: null,
        extra: null,
      },
    ],
  },
  {
    title: 'a note row with a lone dash as its text',
    journal: ['2026-03-02T10:00:00Z\tnote\tn-1\t-'],
    carried: [
      {
        ts: '2026-03-02T10:00:00Z',
        op: 'note',
        id: 'n-1',
        by: 'import',
        text: null,
        why: null,
        extra: null,
      },
    ],
  },
  {
    title: 'an op that is none of the known ones',
    journal: ['2026-03-02T10:00:00Z\tweird\tx-1\tsomething'],
    carried: [
      {
        ts: '2026-03-02T10:00:00Z',
        op: 'weird',
        id: 'x-1',
        by: 'import',
        text: 'something',
        why: null,
        extra: null,
      },
    ],
  },
])('it carries over $title', (row) => {
  const hand = parseHandKeptStore({
    session: 'name=old-notes\ngoal=Ship it\nstarted=2026-03-02T08:00:00Z\n',
    items:
      'id\tkind\tclaim\tcheck\tat_write\tlast\twritten\tby\textra\nt-a\ttask\tWrite it\t-\t-\t-\t2026-03-02T09:00:00Z\tagent\t-\n',
    journal: `${['ts\top\tid\ttext', ...row.journal].join('\n')}\n`,
  });

  const picked = getPickedImport(
    pickImport(hand, {
      name: 'old-notes',
      args: buildParsedArgs(['import', 'old-notes']),
      nowMs: Date.parse('2026-03-10T11:43:00Z'),
      byOwner: false,
      agent: null,
    }),
  );

  expect(picked.journal.slice(0, -1)).toStrictEqual([...row.carried]);
});

test.each([
  {
    title: 'a bare once',
    extra: 'who=owner;where=chat;scope=the repo;once',
    expected: { who: 'owner', where: 'chat', scope: 'the repo' },
  },
  {
    title: 'a use= pair',
    extra: 'use=once;scope=the repo;where=chat;who=owner',
    expected: { who: 'owner', where: 'chat', scope: 'the repo' },
  },
])('it converts an approval with $title', (row) => {
  const hand = parseHandKeptStore({
    session: 'name=old-notes\ngoal=Ship it\nstarted=2026-03-02T08:00:00Z\n',
    items: `${[
      'id\tkind\tclaim\tcheck\tat_write\tlast\twritten\tby\textra',
      buildHandKeptItemRow({ id: 'ok-a', kind: 'ok', extra: row.extra }),
    ].join('\n')}\n`,
    journal: 'ts\top\tid\ttext\n',
  });

  const picked = getPickedImport(
    pickImport(hand, {
      name: 'old-notes',
      args: buildParsedArgs(['import', 'old-notes']),
      nowMs: Date.parse('2026-03-10T11:43:00Z'),
      byOwner: false,
      agent: null,
    }),
  );

  expect(picked.items.map((item) => item.extra)).toStrictEqual([row.expected]);
});

test.each([
  {
    title: 'a task that a done row closed',
    items: [buildHandKeptItemRow({ id: 't-x', kind: 'task' })],
    journal: ['2026-03-04T10:00:00Z\tdone\tt-x\tmerged'],
  },
  {
    title: 'a task that a drop row closed',
    items: [buildHandKeptItemRow({ id: 't-x', kind: 'task' })],
    journal: ['2026-03-04T10:00:00Z\tdrop\tt-x\tno longer needed'],
  },
  {
    title: 'a once approval that a use row spent',
    items: [
      buildHandKeptItemRow({
        id: 't-x',
        kind: 'ok',
        extra: 'who=owner;where=chat;scope=the repo;once',
      }),
    ],
    journal: ['2026-03-04T10:00:00Z\tuse\tt-x\tmerged the PR'],
  },
  {
    title: 'a task that a closed row settled',
    items: [buildHandKeptItemRow({ id: 't-x', kind: 'task' })],
    journal: ['2026-03-04T10:00:00Z\tclosed\tt-x\tmerged'],
  },
])('it leaves out $title, and keeps the open task beside it', (row) => {
  const hand = parseHandKeptStore({
    session: 'name=old-notes\ngoal=Ship it\nstarted=2026-03-02T08:00:00Z\n',
    items: `${[
      'id\tkind\tclaim\tcheck\tat_write\tlast\twritten\tby\textra',
      buildHandKeptItemRow({ id: 't-a' }),
      ...row.items,
    ].join('\n')}\n`,
    journal: `${['ts\top\tid\ttext', ...row.journal].join('\n')}\n`,
  });

  const picked = getPickedImport(
    pickImport(hand, {
      name: 'old-notes',
      args: buildParsedArgs(['import', 'old-notes']),
      nowMs: Date.parse('2026-03-10T11:43:00Z'),
      byOwner: false,
      agent: null,
    }),
  );

  expect(picked.items.map((item) => item.id)).toStrictEqual(['t-a']);
});

test('it converts a whole store as store.md says, and leaves a closed item out', () => {
  const hand = parseHandKeptStore({
    session:
      'name=old-notes\ngoal=Ship it\nstarted=2026-03-02T08:00:00Z\nnow=t-a\nnow_next=go\nnow_set=2026-03-02T09:30:00Z\nformat=0-by-hand\nlast_write=2026-01-01T00:00:00Z\n',
    items: [
      'id\tkind\tclaim\tcheck\tat_write\tlast\twritten\tby\textra',
      't-a\ttask\tWrite it\t-\t-\t-\t2026-03-02T09:00:00Z\tagent\t-',
      't-old\ttask\tOld work\t-\t-\t-\t2026-03-02T09:00:00Z\tagent\t-',
      'w-a\twait\tAnother\t-\t-\t-\t2026-03-02T09:00:00Z\tagent\twho=vendor',
      '',
    ].join('\n'),
    journal: [
      'ts\top\tid\ttext',
      '2026-03-02T08:00:00Z\tinit\told-notes\tStart',
      '2026-03-04T10:00:00Z\tdone\tt-old\tmerged',
      '2026-03-02T10:05:00Z\topen\tq-1\tWhich kilns first',
      '2026-03-03T10:00:00Z\tnote\tn-1\tPORT=8091',
      '',
    ].join('\n'),
  });

  const picked = pickImport(hand, {
    name: 'old-notes',
    args: buildParsedArgs(['import', 'old-notes']),
    nowMs: Date.parse('2026-03-10T11:43:00Z'),
    byOwner: false,
    agent: { harness: 'claude', id: 'a1b2-test' },
  });

  expect(picked).toStrictEqual({
    kind: 'import',
    session: {
      format: '2',
      grant: null,
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
        ts: '2026-03-02T08:00:00Z',
        op: 'init',
        id: 'old-notes',
        by: 'import',
        text: 'Start',
        why: null,
        extra: null,
      },
      {
        ts: '2026-03-04T10:00:00Z',
        op: 'done',
        id: 't-old',
        by: 'import',
        text: 'merged',
        why: null,
        extra: null,
      },
      {
        ts: '2026-03-02T10:05:00Z',
        op: 'wait',
        id: 'q-1',
        by: 'import',
        text: 'Which kilns first',
        why: null,
        extra: 'who=owner',
      },
      {
        ts: '2026-03-03T10:00:00Z',
        op: 'note',
        id: 'n-1',
        by: 'import',
        text: 'PORT=8091',
        why: null,
        extra: null,
      },
      {
        ts: '2026-03-10T11:43:00Z',
        op: 'import',
        id: 'old-notes',
        by: 'agent',
        text: '0-by-hand -> 2',
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
  const hand = parseHandKeptStore({
    session: 'name=old-notes\ngoal=Ship it\nstarted=2026-03-02T08:00:00Z\n',
    items: 'id\tkind\tclaim\tcheck\tat_write\tlast\twritten\tby\textra\n',
    journal: 'ts\top\tid\ttext\n2026-03-02T08:00:00Z\tinit\told-notes\tStart\n',
  });

  const picked = getPickedImport(
    pickImport(hand, {
      name: 'old-notes',
      args: buildParsedArgs(['import', 'old-notes']),
      nowMs: Date.parse('2026-03-10T11:43:00Z'),
      byOwner: false,
      agent: null,
    }),
  );

  expect(picked.journal.map((row) => row.op)).toStrictEqual(['init', 'import']);
});

test('it converts a store with no journal rows, with an empty last_write', () => {
  const hand = parseHandKeptStore({
    session: 'name=old-notes\ngoal=Ship it\nstarted=2026-03-02T08:00:00Z\n',
    items: 'id\tkind\tclaim\tcheck\tat_write\tlast\twritten\tby\textra\n',
    journal: 'ts\top\tid\ttext\n',
  });

  const picked = getPickedImport(
    pickImport(hand, {
      name: 'old-notes',
      args: buildParsedArgs(['import', 'old-notes']),
      nowMs: Date.parse('2026-03-10T11:43:00Z'),
      byOwner: false,
      agent: null,
    }),
  );

  expect(picked.session.lastWrite).toBeNull();
});

test('it converts into files that the store parsers read back whole', () => {
  const hand = parseHandKeptStore({
    session: 'name=old-notes\ngoal=Ship it\nstarted=2026-03-02T08:00:00Z\nnow=t-a\n',
    items: [
      'id\tkind\tclaim\tcheck\tat_write\tlast\twritten\tby\textra',
      't-a\ttask\tWrite it\tpr:kilnworks/pottery-app#12\t-\t-\t2026-03-02T09:00:00Z\tagent\tblocked_by=w-a',
      'ok-a\tok\tmerge it\t-\t-\t-\t2026-03-02T09:00:00Z\tagent\twho=owner;where=chat;scope=the repo;once',
      'w-a\twait\tAnother\t-\t-\t-\t2026-03-02T09:00:00Z\tagent\twho=vendor',
      '',
    ].join('\n'),
    journal: [
      'ts\top\tid\ttext',
      '2026-03-02T08:00:00Z\tinit\told-notes\tStart',
      '2026-03-02T10:00:00Z\tdecide\td-1\tUse A | why: faster',
      '2026-03-02T10:05:00Z\topen\tq-1\tWhich kilns first',
      '2026-03-02T11:00:00Z\tnote\tn-1\t-',
      '',
    ].join('\n'),
  });

  const picked = getPickedImport(
    pickImport(hand, {
      name: 'old-notes',
      args: buildParsedArgs(['import', 'old-notes']),
      nowMs: Date.parse('2026-03-10T11:43:00Z'),
      byOwner: false,
      agent: { harness: 'claude', id: 'a1b2-test' },
    }),
  );

  const readBack = {
    session: parseSessionFile(formatSessionFile(picked.session)),
    items: parseItemsFile(formatItemsFile(picked.items), '2'),
    journal: parseJournalFile(
      `ts\top\tid\tby\ttext\twhy\textra\n${formatJournalRows(picked.journal)}`,
    ),
  };

  expect(readBack).toStrictEqual({
    session: { kind: 'session', session: picked.session },
    items: { kind: 'items', items: [...picked.items] },
    journal: [...picked.journal],
  });
});

test('it converts a store to format 2 with no grant when it holds no standing approval', () => {
  const picked = getPickedImport(
    pickImport(buildHandKeptApprovals(['once']), {
      name: 'old-notes',
      args: buildParsedArgs(['import', 'old-notes']),
      nowMs: Date.parse('2026-03-10T11:43:00Z'),
      byOwner: false,
      agent: null,
    }),
  );

  expect({
    format: picked.session.format,
    grant: picked.session.grant,
    ops: picked.journal.map((row) => row.op),
    importText: picked.journal.at(-1)?.text,
  }).toStrictEqual({ format: '2', grant: null, ops: ['import'], importText: '0-by-hand -> 2' });
});

test('it refuses a standing token with no --may, and prints the flags that fix it', () => {
  const picked = pickImport(buildHandKeptApprovals(['standing']), {
    name: 'old-notes',
    args: buildParsedArgs(['import', 'old-notes']),
    nowMs: Date.parse('2026-03-10T11:43:00Z'),
    byOwner: false,
    agent: null,
  });

  expect(picked).toStrictEqual({
    kind: 'refused',
    refusal: {
      exitCode: 3,
      lines: [
        "www: refused: old-notes holds 1 standing approvals, and format 2 keeps lasting permission in the grant. Record the owner's words in the same command.",
        '  ok-0  "Approval 0" · the repo',
      ],
      runs: [
        {
          www: [
            'import',
            'old-notes',
            '--may',
            toPlaceholder('<what the owner allows, in their words>'),
            '--where',
            'chat',
            '--reading',
            toPlaceholder('<what they cover; what the owner kept back>'),
          ],
        },
      ],
    },
  });
});

test('it folds a standing token into the grant: no item, a drop row, then the grant row', () => {
  const picked = getPickedImport(
    pickImport(buildHandKeptApprovals(['standing', 'once']), {
      name: 'old-notes',
      args: buildParsedArgs([
        'import',
        'old-notes',
        '--may',
        'Merge it\nyourself.',
        '--where',
        'chat',
        '--reading',
        'covers merges',
      ]),
      nowMs: Date.parse('2026-03-10T11:43:00Z'),
      byOwner: true,
      agent: null,
    }),
  );

  expect({
    items: picked.items.map((item) => item.id),
    grant: picked.session.grant,
    rows: picked.journal.map((row) => [row.op, row.id, row.by, row.text, row.why, row.extra]),
  }).toStrictEqual({
    items: ['ok-1'],
    grant: {
      may: ['Merge it yourself.'],
      not: [],
      never: [],
      scope: null,
      reading: 'covers merges',
      where: 'chat',
      set: '2026-03-10T11:43:00Z',
    },
    rows: [
      [
        'drop',
        'ok-0',
        'agent',
        'Approval 0',
        'folded into the grant by the format 2 upgrade',
        null,
      ],
      ['grant', 'grant', 'owner', 'may: Merge it yourself.', 'covers merges', 'where=chat'],
      ['import', 'old-notes', 'agent', '0-by-hand -> 2', null, null],
    ],
  });
});

test('it refuses two one-time approvals, and its Run line drops all but the newest', () => {
  const picked = pickImport(buildHandKeptApprovals(['once', 'once']), {
    name: 'old-notes',
    args: buildParsedArgs(['import', 'old-notes']),
    nowMs: Date.parse('2026-03-10T11:43:00Z'),
    byOwner: false,
    agent: null,
  });

  expect(picked).toStrictEqual({
    kind: 'refused',
    refusal: expect.objectContaining({
      lines: [
        'www: refused: old-notes holds 2 one-time approvals, and format 2 holds 1. Drop all but one.',
        expect.stringContaining('ok-0'),
        expect.stringContaining('ok-1'),
      ],
    }),
  });
});

test('it takes --drop for an approval and leaves the other one-time approval', () => {
  const picked = getPickedImport(
    pickImport(buildHandKeptApprovals(['once', 'once']), {
      name: 'old-notes',
      args: buildParsedArgs(['import', 'old-notes', '--drop', 'ok-0']),
      nowMs: Date.parse('2026-03-10T11:43:00Z'),
      byOwner: false,
      agent: null,
    }),
  );

  expect({
    items: picked.items.map((item) => item.id),
    rows: picked.journal.map((row) => [row.op, row.id, row.why]),
  }).toStrictEqual({
    items: ['ok-1'],
    rows: [
      ['drop', 'ok-0', 'dropped by the format 2 upgrade'],
      ['import', 'old-notes', null],
    ],
  });
});

test('it refuses a question named grant with the item grant problem, and its Run line drops it', () => {
  const hand = parseHandKeptStore({
    session: 'name=old-notes\ngoal=Ship it\nstarted=2026-03-02T08:00:00Z\n',
    items:
      'id\tkind\tclaim\tcheck\tat_write\tlast\twritten\tby\textra\nt-a\ttask\tWrite it\t-\t-\t-\t2026-03-02T09:00:00Z\tagent\t-\n',
    journal: `${['ts\top\tid\ttext', buildHandKeptQuestionRow({ id: 'grant', text: 'Who may merge' })].join('\n')}\n`,
  });

  const picked = pickImport(hand, {
    name: 'old-notes',
    args: buildParsedArgs(['import', 'old-notes']),
    nowMs: Date.parse('2026-03-10T11:43:00Z'),
    byOwner: false,
    agent: null,
  });

  expect(picked).toStrictEqual({
    kind: 'refused',
    refusal: {
      exitCode: 3,
      lines: [
        'www: refused: format 2 keeps the id grant for the grant, and old-notes has an item grant. Drop it, and write it again under a new id after the upgrade.',
      ],
      runs: [{ www: ['import', 'old-notes', '--drop', 'grant'] }],
    },
  });
});

test('it removes a question named grant that --drop names, with a drop row', () => {
  const hand = parseHandKeptStore({
    session: 'name=old-notes\ngoal=Ship it\nstarted=2026-03-02T08:00:00Z\n',
    items:
      'id\tkind\tclaim\tcheck\tat_write\tlast\twritten\tby\textra\nt-a\ttask\tWrite it\t-\t-\t-\t2026-03-02T09:00:00Z\tagent\t-\n',
    journal: `${['ts\top\tid\ttext', buildHandKeptQuestionRow({ id: 'grant', text: 'Who may merge' })].join('\n')}\n`,
  });

  const picked = getPickedImport(
    pickImport(hand, {
      name: 'old-notes',
      args: buildParsedArgs(['import', 'old-notes', '--drop', 'grant']),
      nowMs: Date.parse('2026-03-10T11:43:00Z'),
      byOwner: false,
      agent: null,
    }),
  );

  expect({
    items: picked.items.map((item) => item.id),
    rows: picked.journal.map((row) => [row.op, row.id, row.why]),
  }).toStrictEqual({
    items: ['t-a'],
    rows: [
      ['wait', 'grant', null],
      ['drop', 'grant', 'dropped by the format 2 upgrade'],
      ['import', 'old-notes', null],
    ],
  });
});

test('it imports a hand-kept store with 30 open tasks', () => {
  const hand = parseHandKeptStore({
    session: 'name=old-notes\ngoal=Ship it\nstarted=2026-03-02T08:00:00Z\n',
    items: `${[
      'id\tkind\tclaim\tcheck\tat_write\tlast\twritten\tby\textra',
      ...buildMockIDs('t-', 30).map((id) => buildHandKeptItemRow({ id })),
    ].join('\n')}\n`,
    journal: 'ts\top\tid\ttext\n2026-03-02T08:00:00Z\tinit\told-notes\tStart\n',
  });

  const picked = pickImport(hand, {
    name: 'old-notes',
    args: buildParsedArgs(['import', 'old-notes']),
    nowMs: Date.parse('2026-03-10T11:43:00Z'),
    byOwner: false,
    agent: null,
  });

  expect(picked.kind).toStrictEqual('import');
});
