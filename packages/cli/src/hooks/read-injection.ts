import { match } from 'ts-pattern';
import { renderGoalAndGrant } from '../brief/render-goal-and-grant.ts';
import { redactCredentialWords } from '../rules/redact-credential-words.ts';
import { readSessionFile } from '../store/read-session-file.ts';
import { gateTexts } from './gate-texts.ts';
import type { Harness } from './types.ts';

// The text a SessionStart prints for a bound session: the GOAL and GRANT blocks as the brief prints
// them, then the two lines of the standard reason. A store that needs `www import` gets the two
// lines alone, and one that cannot be read gets null. It opens the `session` file alone.
export async function readInjection(
  sessionFolder: string,
  name: string,
  harness: Harness,
  nowMs: number,
): Promise<string | null> {
  const read = await readSessionFile(sessionFolder);

  const refusal = gateTexts.standardReason(name, harness).split('\n');

  const lines = match(read)
    .with({ kind: 'session' }, (found): string[] | null => [
      ...renderGoalAndGrant(found.session, nowMs),
      ...refusal,
    ])
    .with(
      { kind: 'hand-kept' },
      { kind: 'format-1' },
      { kind: 'newer' },
      (): string[] | null => refusal,
    )
    .with({ kind: 'missing' }, { kind: 'broken' }, (): string[] | null => null)
    .exhaustive();

  return lines === null ? null : `${lines.map((line) => redactCredentialWords(line)).join('\n')}\n`;
}
