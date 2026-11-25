import { textLimits } from '../rules/text-limits.ts';

type JsonShape = 'brief' | 'show' | 'log' | 'list' | 'recap';

// One place a cell of the store reaches the output of a --json read: the read, and the path of
// the value in the JSON it prints.
export interface JsonRedactionRead {
  readonly shape: JsonShape;
  readonly argv: readonly string[];
  readonly path: readonly (string | number)[];
}

// A cell of seed-json-cells-store.ts: its name, the most characters the store holds in it, the
// prefix of each value, whether it refuses ; and =, and each place the output prints it.
export interface JsonRedactionCase {
  readonly cell: string;
  readonly limit: number;

  // the words every value of the cell starts with, ending in a space, so the store reads each value
  // as a check ref; empty for a cell with no such rule
  readonly prefix: string;
  readonly isSeparated: boolean;
  readonly reads: readonly JsonRedactionRead[];
}

// Each free-text cell of the store that a parser keeps as written, with the reads that print it.
// The grant's values and a note are not here, since a parser refuses a credential in each, and an
// id, a ref or a session name holds no space, so format-json-output.test.ts gives each its own row.
export function buildJsonRedactionCases(): JsonRedactionCase[] {
  return [
    {
      cell: 'task claim',
      limit: textLimits.claim,
      prefix: '',
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
      cell: 'task check',
      limit: textLimits.claim,
      prefix: 'path:/work/ ',
      isSeparated: false,
      reads: [
        brief('open', 0, 'row', 'check'),
        show('t-a', 'subjects', 0, 'row', 'check'),
        list('tasks', 'rows', 0, 'row', 'check'),
        recap('notes', 0, 'item', 'row', 'check'),
      ],
    },
    {
      cell: 'task blocked by',
      limit: textLimits.idMax,
      prefix: '',
      isSeparated: true,
      reads: [
        brief('open', 0, 'row', 'extra', 'blocked_by'),
        show('t-a', 'subjects', 0, 'row', 'extra', 'blocked_by'),
        list('tasks', 'rows', 0, 'row', 'extra', 'blocked_by'),
        recap('notes', 0, 'item', 'row', 'extra', 'blocked_by'),
      ],
    },
    {
      cell: 'task pid start',
      limit: textLimits.idMax,
      prefix: '',
      isSeparated: true,
      reads: [
        brief('open', 0, 'row', 'extra', 'pid_start'),
        show('t-a', 'subjects', 0, 'row', 'extra', 'pid_start'),
        list('tasks', 'rows', 0, 'row', 'extra', 'pid_start'),
        recap('notes', 0, 'item', 'row', 'extra', 'pid_start'),
      ],
    },
    {
      cell: 'wait claim',
      limit: textLimits.claim,
      prefix: '',
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
      prefix: '',
      isSeparated: true,
      reads: [
        brief('open', 1, 'row', 'extra', 'who'),
        show('w-a', 'subjects', 0, 'row', 'extra', 'who'),
        list('waits', 'rows', 0, 'row', 'extra', 'who'),
      ],
    },
    {
      cell: 'wait check',
      limit: textLimits.claim,
      prefix: 'path:/work/ ',
      isSeparated: false,
      reads: [
        brief('open', 1, 'row', 'check'),
        show('w-a', 'subjects', 0, 'row', 'check'),
        list('waits', 'rows', 0, 'row', 'check'),
      ],
    },
    {
      cell: 'wait at write',
      limit: textLimits.claim,
      prefix: '',
      isSeparated: false,
      reads: [
        brief('changed', 0, 'was'),
        brief('open', 1, 'row', 'atWrite'),
        show('w-a', 'subjects', 0, 'row', 'atWrite'),
        list('waits', 'rows', 0, 'row', 'atWrite'),
      ],
    },
    {
      cell: 'rule written',
      limit: textLimits.claim,
      prefix: '',
      isSeparated: false,
      reads: [
        brief('open', 3, 'row', 'written'),
        show('r-a', 'subjects', 0, 'row', 'written'),
        list('rules', 'rows', 0, 'row', 'written'),
        recap('notes', 1, 'item', 'row', 'written'),
      ],
    },
    {
      cell: 'approval quote',
      limit: textLimits.quote,
      prefix: '',
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
      prefix: '',
      isSeparated: true,
      reads: [
        brief('open', 2, 'row', 'extra', 'who'),
        show('ok-a', 'subjects', 0, 'row', 'extra', 'who'),
        list('approvals', 'rows', 0, 'row', 'extra', 'who'),
        recap('notes', 2, 'item', 'row', 'extra', 'who'),
      ],
    },
    {
      cell: 'approval where',
      limit: textLimits.approvalWhere,
      prefix: '',
      isSeparated: true,
      reads: [
        brief('open', 2, 'row', 'extra', 'where'),
        show('ok-a', 'subjects', 0, 'row', 'extra', 'where'),
        list('approvals', 'rows', 0, 'row', 'extra', 'where'),
        recap('notes', 2, 'item', 'row', 'extra', 'where'),
      ],
    },
    {
      cell: 'approval scope',
      limit: textLimits.approvalScope,
      prefix: '',
      isSeparated: true,
      reads: [
        brief('open', 2, 'row', 'extra', 'scope'),
        show('ok-a', 'subjects', 0, 'row', 'extra', 'scope'),
        list('approvals', 'rows', 0, 'row', 'extra', 'scope'),
        recap('notes', 2, 'item', 'row', 'extra', 'scope'),
      ],
    },
    {
      cell: 'rule claim',
      limit: textLimits.claim,
      prefix: '',
      isSeparated: false,
      reads: [
        brief('open', 3, 'row', 'claim'),
        show('r-a', 'subjects', 0, 'row', 'claim'),
        list('rules', 'rows', 0, 'row', 'claim'),
      ],
    },
    ...['atWrite', 'last'].map((field) => ({
      cell: field === 'atWrite' ? 'rule at write' : 'rule last',
      limit: textLimits.claim,
      prefix: '',
      isSeparated: false,
      reads: [
        brief('open', 3, 'row', field),
        show('r-a', 'subjects', 0, 'row', field),
        list('rules', 'rows', 0, 'row', field),
        recap('notes', 1, 'item', 'row', field),
      ],
    })),
    {
      cell: 'where claim',
      limit: textLimits.claim,
      prefix: '',
      isSeparated: false,
      reads: [
        brief('open', 4, 'row', 'claim'),
        show('wh-a', 'subjects', 0, 'row', 'claim'),
        list('where', 'rows', 0, 'row', 'claim'),
      ],
    },
    {
      cell: 'goal',
      limit: textLimits.goal,
      prefix: '',
      isSeparated: false,
      reads: [brief('goal')],
    },
    {
      cell: 'next step',
      limit: textLimits.nextStep,
      prefix: '',
      isSeparated: false,
      reads: [brief('next')],
    },
    {
      cell: 'owner note',
      limit: textLimits.ownerNote,
      prefix: '',
      isSeparated: false,
      reads: [brief('ownerNotes', 0, 'text')],
    },
    {
      cell: 'lesson text',
      limit: textLimits.lesson,
      prefix: '',
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
      prefix: '',
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
      prefix: '',
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
      prefix: '',
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
      prefix: '',
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
      prefix: '',
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
      prefix: '',
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
      prefix: '',
      isSeparated: false,
      reads: decisionReads('text'),
    },
    {
      cell: 'decision why',
      limit: textLimits.why,
      prefix: '',
      isSeparated: false,
      reads: decisionReads('why'),
    },
    {
      cell: 'decision extra',
      limit: textLimits.why,
      prefix: '',
      isSeparated: false,
      reads: decisionReads('extra'),
    },
    ...(['text', 'why', 'extra'] as const).map((field) => ({
      cell: `close ${field}`,
      limit: field === 'text' ? textLimits.closeText : textLimits.why,
      prefix: '',
      isSeparated: false,
      reads: [log('rows', 2, field), recap('closedSince', 0, field)],
    })),
    {
      cell: 'decision ts',
      limit: textLimits.claim,
      prefix: '',
      isSeparated: true,
      reads: [
        brief('decisions', 0, 'ts'),
        show('d-1', 'subjects', 0, 'row', 'ts'),
        show('d-1', 'subjects', 0, 'journal', 0, 'ts'),
        list('decisions', 'rows', 0, 'ts'),
      ],
    },
    {
      cell: 'close ts',
      limit: textLimits.claim,
      prefix: '',
      isSeparated: true,
      reads: [log('rows', 2, 'ts')],
    },
    {
      cell: 'journal op',
      limit: textLimits.idMax,
      prefix: '',
      isSeparated: true,
      reads: [log('rows', 1, 'op'), show('ok-a', 'subjects', 0, 'journal', 0, 'op')],
    },
    {
      cell: 'journal id',
      limit: textLimits.idMax,
      prefix: '',
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
