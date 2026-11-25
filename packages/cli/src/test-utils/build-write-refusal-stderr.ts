import { nothingWrittenComment } from '../refusals/format-refusal.ts';
import { isReadCommand } from './is-read-command.ts';

// The stderr a refused command prints, given the stderr without the comment that ends the last Run
// line of a refused write. A read, `www sessions`, `www help` and `goal --paste` keep it as given.
export function buildWriteRefusalStderr(argv: readonly string[], stderr: string): string {
  const command = argv.find((word, at) => !word.startsWith('-') && argv[at - 1] !== '--session');
  const isRead = command === undefined ? true : isReadCommand(command);
  const isPaste = command === 'goal' && argv.includes('--paste');
  const lines = stderr.split('\n');
  const last = lines.findLastIndex((line) => line.startsWith('Run: '));

  if (isRead || isPaste || last === -1) {
    return stderr;
  }

  return lines
    .map((line, at) => (at === last ? `${line}${nothingWrittenComment}` : line))
    .join('\n');
}
