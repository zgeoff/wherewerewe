import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { collectObjectKeys } from './collect-object-keys.ts';
import { listTypeScriptFiles } from './list-type-script-files.ts';
import { stripComments } from './strip-comments.ts';

const agentVariables = ['CLAUDE_CODE_SESSION_ID', 'CODEX_SESSION_ID', 'CODEX_THREAD_ID'];
const runsWWW = /resolveProgram\(["']www["']\)/u;

// Every `file: VARIABLE` of an e2e test that runs www and sets no agent variable as an object key,
// as `NAME: v`, `"NAME": v`, `["NAME"]: v` or the shorthand `NAME`: the process helper spreads
// process.env under the env it is given, so an unset one leaks in.
export function readUnsetAgentVariables(packageDir: string): string[] {
  return listTypeScriptFiles(packageDir, ['e2e']).flatMap((file) => {
    const text = stripComments(readFileSync(join(packageDir, file), 'utf8'));

    if (!runsWWW.test(text)) {
      return [];
    }

    const keys = collectObjectKeys(text);

    return agentVariables
      .filter((variable) => !keys.has(variable))
      .map((variable) => `${file}: ${variable}`);
  });
}
