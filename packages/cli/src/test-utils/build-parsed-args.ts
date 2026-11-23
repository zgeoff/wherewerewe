import { parseCLIArgs } from '../args/parse-cli-args.ts';
import type { ParsedArgs } from '../types.ts';

export function buildParsedArgs(argv: readonly string[]): ParsedArgs {
  const parsed = parseCLIArgs(argv);

  if (parsed.kind === 'refused') {
    throw new Error(`the argv is refused: ${parsed.reason.kind}`);
  }

  return parsed.args;
}
