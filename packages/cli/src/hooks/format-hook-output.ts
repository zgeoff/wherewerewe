import { match } from 'ts-pattern';
import { redactCredentialWords } from '../rules/redact-credential-words.ts';
import { gateTexts } from './gate-texts.ts';
import type { GateOutput, Harness } from './types.ts';

export interface HookOutputInput {
  readonly output: GateOutput;
  readonly event: 'SessionStart' | 'PreToolUse' | 'PostToolUse' | 'SubagentStart' | 'Stop';
  readonly harness: Harness;
  readonly name: string;

  // the injection's lines, for a SessionStart, or the one line of a PostToolUse or a SubagentStart
  readonly text: string;
}

// The stdout of a hook for a gate output, in the shape of its event and harness. Text that holds
// store text passes the credential word pass here, before it is encoded as JSON.
export function formatHookOutput(input: HookOutputInput): string {
  const name = input.name;

  return match(input.output)
    .with({ kind: 'refuse' }, (refuse) => {
      const reason =
        refuse.reason === 'cut'
          ? gateTexts.cutReason(name)
          : gateTexts.standardReason(name, input.harness);

      return encodePreToolUse({
        permissionDecision: 'deny',
        permissionDecisionReason: redactCredentialWords(reason),
      });
    })
    .with({ kind: 'pass-with-line' }, () =>
      encodePreToolUse({ additionalContext: redactCredentialWords(gateTexts.failOpenLine(name)) }),
    )
    .with({ kind: 'block' }, () =>
      JSON.stringify({
        decision: 'block',
        reason: redactCredentialWords(gateTexts.standardReason(name, input.harness)),
      }),
    )
    .with({ kind: 'inject' }, () => input.text)
    .with({ kind: 'pass' }, { kind: 'none' }, () => formatLine(input))
    .exhaustive();
}

function encodePreToolUse(fields: Readonly<Record<string, string>>): string {
  return JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', ...fields } });
}

// A PostToolUse or SubagentStart prints its one line when it has one; every other event prints
// nothing for a pass.
function formatLine(input: HookOutputInput): string {
  if (input.text === '' || (input.event !== 'PostToolUse' && input.event !== 'SubagentStart')) {
    return '';
  }

  return JSON.stringify({
    hookSpecificOutput: {
      hookEventName: input.event,
      additionalContext: redactCredentialWords(input.text),
    },
  });
}
