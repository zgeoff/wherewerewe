import type { BriefInput } from '../brief/types.ts';
import type { Grant } from '../types.ts';
import { toThreeByte } from './to-three-byte.ts';

// The brief input with every stored text in a 3-byte script: each character but a space becomes
// `語`. Ids, the session name, check results and refs stay ASCII, because their rules allow only
// ASCII. Each `who` becomes 3-byte text too, so no wait is on the owner.
export function buildThreeByteBriefInput(input: BriefInput): BriefInput {
  const grant = input.session.grant;

  return {
    ...input,
    session: {
      ...input.session,
      goal: toThreeByte(input.session.goal),
      nowNext: input.session.nowNext === null ? null : toThreeByte(input.session.nowNext),
      grant: grant === null ? null : buildThreeByteGrant(grant),
    },
    items: input.items.map((item) => ({
      ...item,
      claim: toThreeByte(item.claim),
      extra: {
        ...item.extra,
        ...(item.extra.who === undefined ? {} : { who: toThreeByte(item.extra.who) }),
        ...(item.extra.where === undefined ? {} : { where: toThreeByte(item.extra.where) }),
        ...(item.extra.scope === undefined ? {} : { scope: toThreeByte(item.extra.scope) }),
      },
    })),
    notes: input.notes.map((note) => ({ ...note, note: toThreeByte(note.note) })),
    ownerNotes: input.ownerNotes.map((note) => ({ ...note, text: toThreeByte(note.text) })),
    words: input.words.map((row) => ({
      ...row,
      words: toThreeByte(row.words),
      where: toThreeByte(row.where),
    })),
    promises: input.promises.map((row) => ({
      ...row,
      what: toThreeByte(row.what),
      to: toThreeByte(row.to),
      byWhen: toThreeByte(row.byWhen),
    })),
    lessons: input.lessons.map((row) => ({
      ...row,
      text: toThreeByte(row.text),
      why: toThreeByte(row.why),
    })),
    decisions: input.decisions.map((row) => ({ ...row, choice: toThreeByte(row.choice) })),
  };
}

function buildThreeByteGrant(grant: Grant): Grant {
  return {
    ...grant,
    may: grant.may.map(toThreeByte),
    not: grant.not.map(toThreeByte),
    never: grant.never.map(toThreeByte),
    scope: grant.scope === null ? null : toThreeByte(grant.scope),
    reading: toThreeByte(grant.reading),
    where: toThreeByte(grant.where),
  };
}
