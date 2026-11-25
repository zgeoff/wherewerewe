import { createHash } from 'node:crypto';
import skillBody from './www.md' with { type: 'text' };

const description =
  'Keeps what is true in a long agent session in a command-line brief that survives a compaction. Load it at the start of a long or autonomous session, after a compaction, and before stopping work another session will pick up.';

// The `www` skill file this binary carries: frontmatter that marks the version that wrote it and a
// hash of the body, then the body, so `www install` can tell a file it wrote from one it did not.
export function renderSkill(version: string): string {
  const hash = createHash('sha256').update(skillBody).digest('hex');

  return [
    '---',
    'name: www',
    `description: ${JSON.stringify(description)}`,
    'metadata:',
    `  written-by: wherewerewe ${version}`,
    `  body-sha256: ${hash}`,
    '---',
    '',
    skillBody,
  ].join('\n');
}
