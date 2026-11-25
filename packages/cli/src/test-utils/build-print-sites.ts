import { listCommandShapes } from '../args/parse-cli-args.ts';
import { buildUsageRunArgv } from './build-usage-run-argv.ts';

// A command line that can print stored text: a read or a write, with its words after `www`.
export interface PrintSite {
  readonly title: string;
  readonly argv: readonly string[];
}

// A plain value for each placeholder of the help lines, so only the store holds a credential.
const fills: Readonly<Record<string, string>> = {
  '<name>': 'tide-alerts',
  '<goal>': 'Ship the glaze timer',
  '<what done means>': 'Ship the glaze timer',
  '<words>': 'Merge small fixes',
  '<scope>': 'the timer repo',
  '<where>': 'chat',
  '<what they cover; what the owner kept back>': 'Covers merges; the owner kept deploys back',
  '<next step>': 'Start with the parser',
  '"<next step>"': 'Start with the parser',
  '<claim>': 'Write the parser',
  '<what>': 'Answer from the vendor',
  '<who>': 'owner',
  '<do it this way, and why>': 'Run the tests from the repo root',
  '<do this>': 'Pin the clock',
  '<the mistake behind it>': 'A stale row passed',
  '<when>': 'Friday',
  "<the owner's exact words>": 'Keep each change small',
  '<what and where, and how to stop it>': 'A worktree for the timer',
  '<PR, commit or test run>': 'commit 4c1d2e0',
  '<reason>': 'not needed now',
  '<their exact words>': 'merge it yourself',
  '<what you did with it>': 'merged it',
  '<choice>': 'Keep the timer in one file',
  '<text>': 'Plain words please',
  'o-<n>': 'o-1',
};

// Every command of the parser's table, its help line filled with plain values: once for each id
// that `<id>` can take, with the optional id kept, and once for each choice of a choice
// placeholder, such as each kind of `list`. The brief is the command with no words.
export function buildPrintSites(ids: readonly string[]): PrintSite[] {
  const sites = listCommandShapes().flatMap((shape) => {
    const choice = /<[^>]*\|[^>]*>/u.exec(shape.line)?.[0];
    const choices = choice === undefined ? [null] : choice.slice(1, -1).split('|');
    const idValues = shape.line.includes('<id>') ? [null, ...ids] : [null];

    return choices.flatMap((picked) =>
      idValues.map((id) => {
        const choiceFill = picked === null || choice === undefined ? {} : { [choice]: picked };
        const keeps = id === null ? [] : ['<id>', '--id'];

        return buildUsageRunArgv(
          `Run: www ${shape.line}`.trimEnd(),
          { ...fills, ...choiceFill, '<id>': id ?? ids[0] ?? '' },
          keeps,
        );
      }),
    );
  });

  const unique = new Map(sites.map((argv) => [argv.join(' '), argv]));

  return [...unique].map(([joined, argv]) => ({ title: `www ${joined}`.trimEnd(), argv }));
}
