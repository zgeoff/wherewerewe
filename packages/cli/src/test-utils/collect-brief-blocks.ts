import { briefFooter } from '../brief/join-brief.ts';

// Each block's start, in the order of brief.md's worst-case table, named by the start of its label
// there.
const blockStarts = [
  { label: 'goal', starts: 'GOAL' },
  { label: 'grant', starts: 'GRANT' },
  { label: 'owner notes', starts: 'OWNER SAYS' },
  { label: "owner's words", starts: 'WORDS (' },
  { label: 'changed', starts: 'CHANGED SINCE' },
  { label: 'now and its note', starts: 'NOW ' },
  { label: 'open', starts: 'OPEN (' },
  { label: 'waiting', starts: 'WAITING (' },
  { label: 'promised', starts: 'PROMISED (' },
  { label: 'approved once', starts: 'APPROVED ONCE (' },
  { label: 'rules', starts: 'RULES (' },
  { label: 'lessons', starts: 'LESSONS (' },
  { label: 'decisions', starts: 'DECISIONS (' },
  { label: 'where', starts: 'WHERE (' },
  { label: 'pull requests', starts: 'PULL REQUESTS' },
  { label: 'footer', starts: briefFooter },
] as const;

// The bytes of each block, with each newline: the lines from its heading to the next. The header
// has no heading, and a block the brief leaves out has 0 bytes.
export function collectBriefBlocks(
  brief: string,
): readonly { readonly label: string; readonly bytes: number }[] {
  const blocks: { label: string; bytes: number }[] = [
    { label: 'header', bytes: 0 },
    ...blockStarts.map((block) => ({ label: block.label, bytes: 0 })),
  ];

  let current = 0;

  for (const line of brief.split('\n').slice(0, -1)) {
    const next = blockStarts.findIndex((block) => line.startsWith(block.starts));
    const start = next === -1 ? current : next + 1;
    const block = blocks[start];

    current = start;

    if (block !== undefined) {
      block.bytes += Buffer.byteLength(line) + 1;
    }
  }

  return blocks;
}
