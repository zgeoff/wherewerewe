import { join } from 'node:path';

export interface HomePaths {
  readonly home: string;
  readonly claudeSettings: string;
  readonly claudeSkill: string;
  readonly codexHome: string;
  readonly codexHooks: string;
  readonly codexRules: string;
  readonly codexConfig: string;
  readonly codexSkill: string;
}

// Where each file of the install is, from the environment alone, so a test points every path at a
// temp folder. Claude Code's folder moves with `CLAUDE_CONFIG_DIR`, its skills included; Codex's
// moves with `CODEX_HOME`, and its user skills stay under `$HOME/.agents`. `null` with no home.
export function findHomePaths(env: Readonly<Record<string, string | undefined>>): HomePaths | null {
  const home = env['HOME'];

  if (home === undefined || home === '') {
    return null;
  }

  const claudeFolder = nonEmpty(env['CLAUDE_CONFIG_DIR']) ?? join(home, '.claude');
  const codexHome = nonEmpty(env['CODEX_HOME']) ?? join(home, '.codex');

  return {
    home,
    claudeSettings: join(claudeFolder, 'settings.json'),
    claudeSkill: join(claudeFolder, 'skills', 'www', 'SKILL.md'),
    codexHome,
    codexHooks: join(codexHome, 'hooks.json'),
    codexRules: join(codexHome, 'rules', 'wherewerewe.rules'),
    codexConfig: join(codexHome, 'config.toml'),
    codexSkill: join(home, '.agents', 'skills', 'www', 'SKILL.md'),
  };
}

function nonEmpty(value: string | undefined): string | undefined {
  return value === undefined || value === '' ? undefined : value;
}
