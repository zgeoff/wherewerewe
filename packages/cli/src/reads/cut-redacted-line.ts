import { redactCredentialWords } from '../rules/redact-credential-words.ts';
import { cutLine } from './cut-line.ts';

// Redacts the credentials of a line, then cuts it to 100 code points, until a pass changes
// nothing. The `…` of a cut can join the bare name of a credential pattern at the end of the line
// into a match that the output's own redaction then replaces with a longer placeholder.
export function cutRedactedLine(line: string): string {
  const cut = cutLine(redactCredentialWords(line));

  return cut === line ? cut : cutRedactedLine(cut);
}
