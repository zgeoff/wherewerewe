// The known limits of the checks that apply here, printed before the lines for `config.toml`, so
// an owner sees them when install adds the allow rule. Nothing when none applies.
export function formatCheckLimits(limits: readonly string[]): string {
  if (limits.length === 0) {
    return '';
  }

  return [
    'www install: with the allow rules, a check runs git and gh with no prompt. Limits of the checks that apply here (docs/design/wherewerewe/checks.md, "Known limits of the probes"):',
    ...limits.map((limit) => `- ${limit}`),
    '',
  ].join('\n');
}
