import { join } from 'node:path';
import type { Env } from '../types.ts';
import type { Paths } from './types.ts';

export function readPaths(env: Env): Paths {
  const home = env['HOME'] ?? '.';
  const claude = env['CLAUDE_CONFIG_DIR'] ?? join(home, '.claude');
  const codex = env['CODEX_HOME'] ?? join(home, '.codex');

  return {
    claudeSettings: join(claude, 'settings.json'),
    codexHooks: join(codex, 'hooks.json'),
    codexRules: join(codex, 'rules', 'wherewerewe.rules'),
    codexConfig: join(codex, 'config.toml'),
    skills: [
      join(claude, 'skills', 'www', 'SKILL.md'),
      join(home, '.agents', 'skills', 'www', 'SKILL.md'),
    ],
  };
}
