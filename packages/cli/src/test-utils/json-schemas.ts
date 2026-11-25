import { z } from 'zod';

const itemKinds = ['task', 'wait', 'ok', 'rule', 'where'] as const;

const item = z.strictObject({
  id: z.string(),
  kind: z.enum(itemKinds),
  claim: z.string(),
  check: z.string().nullable(),
  atWrite: z.string().nullable(),
  last: z.string().nullable(),
  written: z.string(),
  by: z.enum(['agent', 'owner', 'import']),
  extra: z.strictObject({
    who: z.string().optional(),
    where: z.string().optional(),
    scope: z.string().optional(),
    blocked_by: z.string().optional(),
    pid_start: z.string().optional(),
  }),
});

const note = z.strictObject({
  id: z.string(),
  owed: z.boolean(),
  written: z.string(),
  note: z.string(),
});

const lesson = z.strictObject({
  id: z.string(),
  text: z.string(),
  why: z.string(),
  written: z.string(),
  by: z.enum(['agent', 'owner']),
});

const promise = z.strictObject({
  id: z.string(),
  what: z.string(),
  to: z.string(),
  byWhen: z.string(),
  written: z.string(),
  by: z.enum(['agent', 'owner']),
});

const words = z.strictObject({
  id: z.string(),
  words: z.string(),
  where: z.string(),
  written: z.string(),
  by: z.enum(['agent', 'owner']),
});

const journalRow = z.strictObject({
  ts: z.string(),
  op: z.string(),
  id: z.string(),
  by: z.enum(['agent', 'owner', 'hook', 'import']),
  text: z.string().nullable(),
  why: z.string().nullable(),
  extra: z.string().nullable(),
});

const prRow = z.strictObject({
  ref: z.string(),
  opened: z.string(),
  state: z.enum(['OPEN', 'MERGED', 'CLOSED']).nullable(),
  seen: z.string().nullable(),
});

const grantOpts = z.strictObject({
  may: z.array(z.string()).optional(),
  not: z.array(z.string()).optional(),
  never: z.array(z.string()).optional(),
  scope: z.string().optional(),
  where: z.string(),
  reading: z.string(),
});

const shown = z.discriminatedUnion('kind', [
  buildItemShown('task'),
  buildItemShown('wait'),
  buildItemShown('ok'),
  buildItemShown('rule'),
  buildItemShown('where'),
  z.strictObject({ kind: z.literal('lesson'), row: lesson, note: z.null() }),
  z.strictObject({ kind: z.literal('promise'), row: promise, note: z.null() }),
  z.strictObject({ kind: z.literal('words'), row: words, note: z.null() }),
]);

const journal = z.array(journalRow).nullable();

const ownerNote = z.strictObject({
  id: z.string(),
  text: z.string(),
  said: z.string(),
  on: z.string().nullable(),
});

const changedRow = z.strictObject({ id: z.string(), was: z.string(), now: z.string() });
const limit = z.strictObject({ bytes: z.number(), tokens: z.number() });
const recapNote = z.strictObject({ item: shown, note });

const subject = z.discriminatedUnion('kind', [
  buildItemSubject('task'),
  buildItemSubject('wait'),
  buildItemSubject('ok'),
  buildItemSubject('rule'),
  buildItemSubject('where'),
  buildFileSubject(z.literal('lesson'), lesson),
  buildFileSubject(z.literal('promise'), promise),
  buildFileSubject(z.literal('words'), words),
  z.strictObject({ kind: z.literal('grant'), row: grantOpts.nullable(), journal }),
  z.strictObject({ kind: z.literal('decision'), row: journalRow, journal }),
]);

// One strict schema for each type of lists-and-json.md. A field the type lacks and a field it
// requires each fail the parse, so a change to a type fails until the schema changes with it.
export const jsonSchemas = {
  brief: versioned({
    session: z.string(),
    day: z.number(),
    host: z.enum(['claude', 'codex', 'none']),
    limit,
    estimate: z.number(),
    goal: z.string(),
    grant: grantOpts.nullable(),
    ownerNotes: z.array(ownerNote),
    words: z.array(words),
    changed: z.array(changedRow),
    focus: z.string().nullable(),
    next: z.string().nullable(),
    open: z.array(shown),
    lessons: z.array(lesson),
    promises: z.array(promise),
    decisions: z.array(journalRow),
    prs: z.array(prRow),
  }),
  show: versioned({ subjects: z.array(subject) }),
  log: versioned({ rows: z.array(journalRow) }),
  list: z.discriminatedUnion('kind', [
    versioned({ kind: z.literal('decisions'), rows: z.array(journalRow) }),
    versioned({ kind: z.literal('prs'), rows: z.array(prRow) }),
    versioned({ kind: z.literal('notes'), rows: z.array(note) }),
    buildShownList('tasks'),
    buildShownList('waits'),
    buildShownList('approvals'),
    buildShownList('rules'),
    buildShownList('where'),
    buildShownList('lessons'),
    buildShownList('promises'),
    buildShownList('words'),
  ]),
  recap: versioned({
    session: z.string(),
    day: z.number(),
    since: z.string(),
    writes: z.number().nullable(),
    grant: grantOpts.nullable(),
    promises: z.array(promise),
    notes: z.array(recapNote),
    otherOpen: z.array(z.string()),
    decidedSince: journal,
    closedSince: journal,
  }),
};

function versioned<Shape extends z.core.$ZodLooseShape>(shape: Shape) {
  // oxlint-disable-next-line id-length -- the wire format names this key v
  return z.strictObject({ v: z.literal(1), ...shape });
}

function buildItemShown<Kind extends (typeof itemKinds)[number]>(kind: Kind) {
  return z.strictObject({ kind: z.literal(kind), row: item, note: note.nullable() });
}

function buildItemSubject<Kind extends (typeof itemKinds)[number]>(kind: Kind) {
  return buildFileSubject(z.literal(kind), item).extend({ note: note.nullable() });
}

function buildFileSubject<Kind extends z.ZodLiteral<string>, Row extends z.ZodType>(
  kind: Kind,
  row: Row,
) {
  return z.strictObject({
    kind,
    row,
    note: z.null(),
    checkedNow: z.string().nullable(),
    failingChecks: z.array(z.string()),
    decisions: z.array(z.string()),
    journal,
  });
}

function buildShownList<Kind extends string>(kind: Kind) {
  return versioned({ kind: z.literal(kind), rows: z.array(shown) });
}
