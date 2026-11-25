import { isRecord } from '../hooks/is-record.ts';
import { buildFailedCheck } from './build-failed-check.ts';
import { parseJSONSettings } from './parse-json-settings.ts';
import { allowRule } from './types.ts';
import type { DoctorCheck } from './types.ts';

// Checks that `permissions.allow` holds the rule for www, and that no deny or ask rule matches
// www, since a matching ask rule prompts even when an allow rule matches the same call. A rule is
// never printed, only its place: a rule can hold anything the user typed.
export function checkAllowRule(text: string | null, shown: string): DoctorCheck {
  const read = parseJSONSettings(text ?? '');

  const permissions =
    read.kind === 'object' && isRecord(read.value['permissions']) ? read.value['permissions'] : {};

  const allow: unknown[] = Array.isArray(permissions['allow']) ? permissions['allow'] : [];

  const blockers = ['deny', 'ask'].flatMap((list) => {
    const rules: unknown[] = Array.isArray(permissions[list]) ? permissions[list] : [];

    return rules.flatMap((rule, at) =>
      typeof rule === 'string' && isRuleForWww(rule)
        ? [
            `www doctor: rule ${String(at + 1)} of permissions.${list} in ${shown} matches www, so Claude Code does not run it without asking.`,
          ]
        : [],
    );
  });

  const missing = allow.includes(allowRule)
    ? []
    : [
        `www doctor: no allow rule for www in ${shown}, so Claude Code asks before each www call.`,
        'Run: www install',
      ];

  if (missing.length > 0 || blockers.length > 0) {
    return buildFailedCheck([...missing, ...blockers]);
  }

  return { isOk: true, lines: [`ok: ${shown} allows ${allowRule}`] };
}

// Whether a Claude Code Bash rule matches the bare command `www`: its pattern is `www`, a glob
// that reaches it, or a `www *` that the docs say matches the bare command too.
function isRuleForWww(rule: string): boolean {
  const inner = /^Bash\((?<pattern>.*)\)$/u.exec(rule)?.groups?.['pattern'];

  if (inner === undefined) {
    return false;
  }

  const bare = inner.endsWith(' *') ? inner.slice(0, -2) : inner;
  const source = bare.replaceAll(/[.+?^${}()|[\]\\]/gu, String.raw`\$&`).replaceAll('*', '.*');

  return new RegExp(`^${source}$`, 'u').test('www') || inner === 'www:*';
}
