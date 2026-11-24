import { buildFilledRunArgv } from './build-filled-run-argv.ts';
import { parseRunLine } from './parse-run-line.ts';

// The arguments of a Run line with every placeholder filled by one short word, so a filled grant
// stays within its limits: an id or a name takes a new id, and a decision's who takes agent.
export function buildSampleRunArgv(line: string): readonly string[] {
  return buildFilledRunArgv(
    line,
    Object.fromEntries(
      parseRunLine(line).flatMap((word) => {
        if (!/<[^<>]+>/u.test(word)) {
          return [];
        }

        if (word === '<owner or agent>') {
          return [[word, 'agent']];
        }

        return [[word, /id>$|^<name>$/u.test(word) ? 'n-c' : 'x']];
      }),
    ),
  );
}
