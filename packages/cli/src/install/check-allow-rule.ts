import { isRecord } from '../hooks/is-record.ts';
import { buildFailedCheck } from './build-failed-check.ts';
import { parseJSONSettings } from './parse-json-settings.ts';
import { allowRule } from './types.ts';
import type { DoctorCheck } from './types.ts';

export interface PermissionLayer {
  readonly shown: string;

  // `null` for a file that does not exist
  readonly text: string | null;
}

// Checks that a layer of Claude Code settings allows www, and that no layer has a deny or ask rule
// that matches www, since either stops the allow rule. The first layer is the user file, which
// names the fix. A rule is never printed, only its place: it can hold anything the user typed.
export function checkAllowRule(layers: readonly PermissionLayer[]): DoctorCheck {
  const shown = layers[0]?.shown ?? '';

  const parsed = layers.map((layer) => ({
    shown: layer.shown,
    permissions: readPermissions(layer),
  }));

  const isAllowed = parsed.some((layer) =>
    readRules(layer.permissions, 'allow').includes(allowRule),
  );

  const blockers = parsed.flatMap((layer) =>
    ['deny', 'ask'].flatMap((list) =>
      readRules(layer.permissions, list).flatMap((rule, at) =>
        typeof rule === 'string' && isRuleForWww(rule)
          ? [
              `www doctor: rule ${String(at + 1)} of permissions.${list} in ${layer.shown} matches www, so Claude Code does not run it without asking.`,
            ]
          : [],
      ),
    ),
  );

  const missing = isAllowed
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

function readPermissions(layer: PermissionLayer): Readonly<Record<string, unknown>> {
  const read = parseJSONSettings(layer.text ?? '');

  return read.kind === 'object' && isRecord(read.value['permissions'])
    ? read.value['permissions']
    : {};
}

function readRules(permissions: Readonly<Record<string, unknown>>, list: string): unknown[] {
  const rules = permissions[list];

  return Array.isArray(rules) ? rules : [];
}

// Whether a Claude Code Bash rule matches the bare command `www`: the rule `Bash` alone, whose
// pattern is every command, or a pattern that is `www`, a glob that reaches it, or a `www *` that
// the docs say matches the bare command too.
function isRuleForWww(rule: string): boolean {
  if (rule === 'Bash') {
    return true;
  }

  const inner = /^Bash\((?<pattern>.*)\)$/u.exec(rule)?.groups?.['pattern'];

  if (inner === undefined) {
    return false;
  }

  const bare = inner.endsWith(' *') ? inner.slice(0, -2) : inner;
  const source = bare.replaceAll(/[.+?^${}()|[\]\\]/gu, String.raw`\$&`).replaceAll('*', '.*');

  return new RegExp(`^${source}$`, 'u').test('www') || inner === 'www:*';
}
