import { redactCredentialWords } from '../rules/redact-credential-words.ts';
import { buildItemSections } from './build-item-sections.ts';
import { cutRanks } from './cut-ranks.ts';
import { joinBrief } from './join-brief.ts';
import { orderOpenTasks } from './order-open-tasks.ts';
import { pickBriefLimit } from './pick-brief-limit.ts';
import type { BriefInput, ItemSection } from './types.ts';

// Renders every section of the brief with every row, then drops one row at a time while its bytes
// pass the host's limit: from the first rank of the cut order that still has a row, the row last
// in its section. `limitBytes` is for tests; production passes nothing.
export function renderBrief(input: BriefInput, limitBytes?: number): string {
  const limit = limitBytes ?? pickBriefLimit(input.host).bytes;
  const sections = buildItemSections(input, orderOpenTasks(input));
  const cuts: boolean[][] = sections.map((section) => section.lines.map(() => false));

  const seen = new Map<string, string>();

  const redactLine = (line: string): string => {
    const known = seen.get(line);
    const redacted = known ?? redactCredentialWords(line);

    seen.set(line, redacted);

    return redacted;
  };

  let text = joinBrief(input, sections, cuts, redactLine);

  while (Buffer.byteLength(text, 'utf8') > limit) {
    const target = findCutTarget(sections, cuts);

    if (target === null) {
      break;
    }

    const row = cuts[target.section];

    if (row !== undefined) {
      row[target.line] = true;
    }

    text = joinBrief(input, sections, cuts, redactLine);
  }

  return text;
}

function findCutTarget(
  sections: readonly ItemSection[],
  cuts: readonly (readonly boolean[])[],
): { readonly section: number; readonly line: number } | null {
  for (const rank of cutRanks) {
    for (const [sectionIndex, section] of sections.entries()) {
      const line = section.lines.findLastIndex(
        (candidate, index) => candidate.rank === rank && cuts[sectionIndex]?.[index] === false,
      );

      if (line !== -1) {
        return { section: sectionIndex, line };
      }
    }
  }

  return null;
}
