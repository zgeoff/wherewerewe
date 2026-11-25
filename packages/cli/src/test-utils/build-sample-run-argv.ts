import { buildUsageRunArgv } from './build-usage-run-argv.ts';
import { parseRunLine } from './parse-run-line.ts';

// The arguments of a Run line with every placeholder filled by one short word, so a filled grant
// stays within its limits: an id or a name takes a new id, and a decision's who takes agent. A usage
// line keeps its `--may` group and drops its other optional groups.
export function buildSampleRunArgv(line: string): readonly string[] {
  return buildUsageRunArgv(
    line,
    Object.fromEntries(
      parseRunLine(line).flatMap((word) => {
        const bare = word.replaceAll(/^\[+|\]+$/gu, '');

        if (!/<[^<>|]+>/u.test(bare)) {
          return [];
        }

        if (bare === '<owner or agent>') {
          return [[bare, 'agent']];
        }

        return [[bare, /id>$|^<name>$/u.test(bare) ? 'n-c' : 'x']];
      }),
    ),
    ['--may'],
  );
}
