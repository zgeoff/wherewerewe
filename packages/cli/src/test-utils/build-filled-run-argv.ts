import { parseRunLine } from './parse-run-line.ts';

// The arguments of a Run line with each placeholder replaced from the fills, which are keyed by
// the placeholder as the line writes it, such as `<new id>`. It throws when one is left.
export function buildFilledRunArgv(
  line: string,
  fills: Readonly<Record<string, string>>,
): readonly string[] {
  return parseRunLine(line).map((word) => {
    const fill = fills[word];

    if (fill !== undefined) {
      return fill;
    }

    if (/<[^>]*>/u.test(word)) {
      throw new Error(`no fill for the placeholder ${word} in: ${line}`);
    }

    return word;
  });
}
