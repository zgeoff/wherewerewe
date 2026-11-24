const COMMENT_OR_STRING =
  /(?<string>"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`)|\/\*[\s\S]*?\*\/|\/\/.*$/gmu;

// The source text with each block comment and each line comment cut out, so a name in a comment
// counts as no use. A `//` or `/*` inside a string literal stays, so a URL in a string stays.
export function stripComments(source: string): string {
  return source.replaceAll(COMMENT_OR_STRING, (match, string: string | undefined) =>
    string === undefined ? '' : match,
  );
}
