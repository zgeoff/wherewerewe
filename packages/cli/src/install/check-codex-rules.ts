import { buildFailedCheck } from './build-failed-check.ts';
import { parseExecpolicyDecision } from './parse-execpolicy-decision.ts';
import { runExecpolicy } from './run-execpolicy.ts';
import { codexRuleLine } from './types.ts';
import type { DoctorCheck } from './types.ts';

export interface CodexRulesInput {
  readonly path: string;
  readonly shown: string;
  readonly text: string | null;

  // the codex program found on a safe PATH, or `null`
  readonly codex: string | null;
  readonly env: Readonly<Record<string, string | undefined>>;
}

// Checks the rules file of install's own: it exists, it holds the one rule, and `codex execpolicy
// check` decides `allow` for `www`, so a later Codex that changes or drops rules shows up here.
export function checkCodexRules(input: CodexRulesInput): DoctorCheck {
  if (input.text === null) {
    return buildFailedCheck([
      `www doctor: ${input.shown} does not exist, so Codex does not allow www without asking.`,
      'Run: www install',
    ]);
  }

  if (input.text !== `${codexRuleLine}\n`) {
    return buildFailedCheck([
      `www doctor: ${input.shown} is not the one rule that www install writes.`,
      'Run: www install --print',
    ]);
  }

  if (input.codex === null) {
    return buildFailedCheck([
      'www doctor: codex is not on PATH, so the Codex rule is not checked.',
    ]);
  }

  const printed = runExecpolicy(input.codex, input.path, input.env);
  const decision = printed === null ? null : parseExecpolicyDecision(printed);

  if (decision === null) {
    return buildFailedCheck([
      'www doctor: codex execpolicy check printed no decision that doctor can read for www.',
    ]);
  }

  if (decision !== 'allow') {
    return buildFailedCheck([
      `www doctor: Codex decides "${decision}" for www with ${input.shown}, not "allow".`,
      'Run: www install',
    ]);
  }

  return { isOk: true, lines: [`ok: Codex allows www through ${input.shown}`] };
}
