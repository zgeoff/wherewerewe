import { textLimits } from '../rules/text-limits.ts';

type JsonShape = 'brief' | 'show' | 'log' | 'list' | 'recap';

// One place a cell of the store reaches the output of a --json read: the read, and the path of
// the value in the JSON it prints.
export interface JsonRedactionRead {
  readonly shape: JsonShape;
  readonly argv: readonly string[];
  readonly path: readonly (string | number)[];
}

// A cell of seed-json-cells-store.ts: its name, the most characters the store holds in it, whether
// it refuses ; and =, and each place the output prints it.
export interface JsonRedactionCase {
  readonly cell: string;
  readonly limit: number;
  readonly isSeparated: boolean;
  readonly reads: readonly JsonRedactionRead[];
}

// Every string field of every shape that a store cell feeds and every store parser accepts, with the
// reads that print it. The grant's values and a note are not here: a parser refuses a
// credential in each, as json-redaction.test.ts checks.
export function buildJsonRedactionCases(): JsonRedactionCase[] {
  return [
    {
      cell: 'task claim',
      limit: textLimits.claim,
      isSeparated: false,
      reads: [
        brief('open', 0, 'row', 'claim'),
        show(null, 'subjects', 0, 'row', 'claim'),
        show('t-a', 'subjects', 0, 'row', 'claim'),
        list('tasks', 'rows', 0, 'row', 'claim'),
        recap('notes', 0, 'item', 'row', 'claim'),
      ],
    },
    {
      cell: 'wait claim',
      limit: textLimits.claim,
      isSeparated: false,
      reads: [
        brief('open', 1, 'row', 'claim'),
        show('w-a', 'subjects', 0, 'row', 'claim'),
        list('waits', 'rows', 0, 'row', 'claim'),
      ],
    },
    {
      cell: 'wait who',
      limit: textLimits.waitWho,
      isSeparated: true,
      reads: [
        brief('open', 1, 'row', 'extra', 'who'),
        show('w-a', 'subjects', 0, 'row', 'extra', 'who'),
        list('waits', 'rows', 0, 'row', 'extra', 'who'),
      ],
    },
    {
      cell: 'approval quote',
      limit: textLimits.quote,
      isSeparated: false,
      reads: [
        brief('open', 2, 'row', 'claim'),
        show('ok-a', 'subjects', 0, 'row', 'claim'),
        list('approvals', 'rows', 0, 'row', 'claim'),
      ],
    },
    {
      cell: 'approval who',
      limit: textLimits.approvalWho,
      isSeparated: true,
      reads: [
        brief('open', 2, 'row', 'extra', 'who'),
        show('ok-a', 'subjects', 0, 'row', 'extra', 'who'),
        list('approvals', 'rows', 0, 'row', 'extra', 'who'),
      ],
    },
    {
      cell: 'approval where',
      limit: textLimits.approvalWhere,
      isSeparated: true,
      reads: [
        brief('open', 2, 'row', 'extra', 'where'),
        show('ok-a', 'subjects', 0, 'row', 'extra', 'where'),
        list('approvals', 'rows', 0, 'row', 'extra', 'where'),
      ],
    },
    {
      cell: 'approval scope',
      limit: textLimits.approvalScope,
      isSeparated: true,
      reads: [
        brief('open', 2, 'row', 'extra', 'scope'),
        show('ok-a', 'subjects', 0, 'row', 'extra', 'scope'),
        list('approvals', 'rows', 0, 'row', 'extra', 'scope'),
      ],
    },
    {
      cell: 'rule claim',
      limit: textLimits.claim,
      isSeparated: false,
      reads: [
        brief('open', 3, 'row', 'claim'),
        show('r-a', 'subjects', 0, 'row', 'claim'),
        list('rules', 'rows', 0, 'row', 'claim'),
      ],
    },
    {
      cell: 'where claim',
      limit: textLimits.claim,
      isSeparated: false,
      reads: [
        brief('open', 4, 'row', 'claim'),
        show('wh-a', 'subjects', 0, 'row', 'claim'),
        list('where', 'rows', 0, 'row', 'claim'),
      ],
    },
    { cell: 'goal', limit: textLimits.goal, isSeparated: false, reads: [brief('goal')] },
    {
      cell: 'next step',
      limit: textLimits.nextStep,
      isSeparated: false,
      reads: [brief('next')],
    },
    {
      cell: 'owner note',
      limit: textLimits.ownerNote,
      isSeparated: false,
      reads: [brief('ownerNotes', 0, 'text')],
    },
    {
      cell: 'lesson text',
      limit: textLimits.lesson,
      isSeparated: false,
      reads: [
        brief('lessons', 0, 'text'),
        show('l-a', 'subjects', 0, 'row', 'text'),
        list('lessons', 'rows', 0, 'row', 'text'),
      ],
    },
    {
      cell: 'lesson why',
      limit: textLimits.lessonWhy,
      isSeparated: false,
      reads: [
        brief('lessons', 0, 'why'),
        show('l-a', 'subjects', 0, 'row', 'why'),
        list('lessons', 'rows', 0, 'row', 'why'),
      ],
    },
    {
      cell: 'promise what',
      limit: textLimits.promise,
      isSeparated: false,
      reads: [
        brief('promises', 0, 'what'),
        show('p-a', 'subjects', 0, 'row', 'what'),
        list('promises', 'rows', 0, 'row', 'what'),
        recap('promises', 0, 'what'),
      ],
    },
    {
      cell: 'promise to',
      limit: textLimits.promiseTo,
      isSeparated: true,
      reads: [
        brief('promises', 0, 'to'),
        show('p-a', 'subjects', 0, 'row', 'to'),
        list('promises', 'rows', 0, 'row', 'to'),
        recap('promises', 0, 'to'),
      ],
    },
    {
      cell: 'promise by',
      limit: textLimits.promiseBy,
      isSeparated: true,
      reads: [
        brief('promises', 0, 'byWhen'),
        show('p-a', 'subjects', 0, 'row', 'byWhen'),
        list('promises', 'rows', 0, 'row', 'byWhen'),
        recap('promises', 0, 'byWhen'),
      ],
    },
    {
      cell: 'words',
      limit: textLimits.words,
      isSeparated: false,
      reads: [
        brief('words', 0, 'words'),
        show('w-b', 'subjects', 0, 'row', 'words'),
        list('words', 'rows', 0, 'row', 'words'),
      ],
    },
    {
      cell: 'words where',
      limit: textLimits.wordsWhere,
      isSeparated: true,
      reads: [
        brief('words', 0, 'where'),
        show('w-b', 'subjects', 0, 'row', 'where'),
        list('words', 'rows', 0, 'row', 'where'),
      ],
    },
    {
      cell: 'decision choice',
      limit: textLimits.decision,
      isSeparated: false,
      reads: decisionReads('text'),
    },
    {
      cell: 'decision why',
      limit: textLimits.why,
      isSeparated: false,
      reads: decisionReads('why'),
    },
    {
      cell: 'decision extra',
      limit: textLimits.why,
      isSeparated: false,
      reads: decisionReads('extra'),
    },
    {
      cell: 'journal op',
      limit: textLimits.idMax,
      isSeparated: true,
      reads: [log('rows', 1, 'op')],
    },
    {
      cell: 'journal id',
      limit: textLimits.idMax,
      isSeparated: true,
      reads: [log('rows', 1, 'id')],
    },
  ];
}

type Path = (string | number)[];

function brief(...path: Path): JsonRedactionRead {
  return { shape: 'brief', argv: [], path };
}

function show(id: string | null, ...path: Path): JsonRedactionRead {
  return { shape: 'show', argv: id === null ? ['show'] : ['show', id], path };
}

function list(kind: string, ...path: Path): JsonRedactionRead {
  return { shape: 'list', argv: ['list', kind], path };
}

function recap(...path: Path): JsonRedactionRead {
  return { shape: 'recap', argv: ['recap'], path };
}

// The decision row d-1 reaches the output of six reads, at one field.
function decisionReads(field: string): JsonRedactionRead[] {
  return [
    brief('decisions', 0, field),
    show('d-1', 'subjects', 0, 'row', field),
    show('d-1', 'subjects', 0, 'journal', 0, field),
    log('rows', 0, field),
    list('decisions', 'rows', 0, field),
    recap('decidedSince', 0, field),
  ];
}

function log(...path: Path): JsonRedactionRead {
  return { shape: 'log', argv: ['log'], path };
}
