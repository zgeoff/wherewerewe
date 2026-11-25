import type { RunWord } from '../types.ts';
import { toUsageWords } from './to-usage-words.ts';

// The required words of a help line, then the required words with each optional group added in
// turn, or each choice of a group that holds ` | `, with a group nested in it kept with it. A
// `[<check>]` group becomes `--pr` with a sample of its form.
export function collectUsageVariants(line: string): RunWord[][] {
  const nodes = parseNodes(line);

  const groups = nodes.flatMap((node, index) =>
    typeof node === 'string' ? [] : node.choices.map((choice) => ({ index, choice })),
  );

  const variants = groups.map((group) =>
    nodes.flatMap((node, index) => {
      if (typeof node === 'string') {
        return [node];
      }

      return index === group.index ? flatten(group.choice) : [];
    }),
  );

  return [toUsageWords(line), ...variants.map((words) => toUsageWords(words.join(' ')))];
}

type UsageNode = string | { readonly choices: readonly (readonly UsageNode[])[] };

function parseNodes(line: string): UsageNode[] {
  const stack: UsageNode[][] = [[]];

  for (const token of line.match(/\[*"[^"]*"\]*|\S+/gu) ?? []) {
    const opens = /^\[*/u.exec(token)?.[0].length ?? 0;
    const closes = /\]*$/u.exec(token.slice(opens))?.[0].length ?? 0;
    const bare = token.slice(opens, token.length - closes);

    for (let count = 0; count < opens; count += 1) {
      stack.push([]);
    }

    if (bare !== '') {
      stack.at(-1)?.push(bare);
    }

    for (let count = 0; count < closes; count += 1) {
      const frame = stack.pop() ?? [];

      stack.at(-1)?.push({ choices: splitChoices(frame) });
    }
  }

  return stack[0] ?? [];
}

function splitChoices(frame: readonly UsageNode[]): UsageNode[][] {
  const choices: UsageNode[][] = [[]];

  for (const node of frame) {
    if (node === '|') {
      choices.push([]);
    } else {
      choices.at(-1)?.push(node);
    }
  }

  return choices;
}

function flatten(nodes: readonly UsageNode[]): string[] {
  return nodes.flatMap((node) => {
    if (typeof node === 'string') {
      return node === '<check>' ? ['--pr', 'acme/tool#1'] : [node];
    }

    return flatten(node.choices[0] ?? []);
  });
}
