import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// The text of the first fenced block after a heading of a design doc, with its fence cut off. The
// heading is matched whole, such as `### www goal --paste`.
export function readDesignBlock(doc: string, heading: string, fence: string): string {
  const text = readFileSync(
    join(import.meta.dir, '..', '..', '..', '..', 'docs', 'design', 'wherewerewe', doc),
    'utf8',
  );

  const section = text.slice(text.indexOf(`${heading}\n`));

  return (
    new RegExp(`\`\`\`${fence}\\n(?<block>.*?)\`\`\``, 'su').exec(section)?.groups?.['block'] ?? ''
  );
}
