import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { listTypeScriptFiles } from './list-type-script-files.ts';
import { stripComments } from './strip-comments.ts';

const agentVariables = ['CLAUDE_CODE_SESSION_ID', 'CODEX_SESSION_ID', 'CODEX_THREAD_ID'];
const runsWWW = /resolveProgram\(["']www["']\)/u;

// Every `file: VARIABLE` of an e2e test that runs www and sets no agent variable as an object key:
// the process helper spreads process.env under the env it is given, so an unset one leaks in.
// A name in a comment or a string sets nothing.
export function readUnsetAgentVariables(packageDir: string): string[] {
  return listTypeScriptFiles(packageDir, ['e2e']).flatMap((file) => {
    const text = stripComments(readFileSync(join(packageDir, file), 'utf8'));

    return runsWWW.test(text)
      ? agentVariables
          .filter((variable) => !new RegExp(`(?:^|[{,\\s])${variable}:`, 'mu').test(text))
          .map((variable) => `${file}: ${variable}`)
      : [];
  });
}
