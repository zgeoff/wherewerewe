import type { HookEntry } from './build-hook-entries.ts';
import type { HomePaths } from './find-home-paths.ts';
import { formatDisplayPath } from './format-display-path.ts';
import { planClaudeSettings } from './plan-claude-settings.ts';
import { planCodexHooks } from './plan-codex-hooks.ts';
import { planRulesFile } from './plan-rules-file.ts';
import { planSkillFile } from './plan-skill-file.ts';
import type { FilePlan } from './types.ts';

export interface InstallItem {
  readonly path: string;
  readonly shown: string;
  readonly kind: 'settings' | 'hooks' | 'rules' | 'skill';

  // the mode of the file when it does not exist yet
  readonly newMode: number;
  readonly plan: (before: string | null) => FilePlan;
}

export interface InstallItemInputs {
  readonly paths: HomePaths;
  readonly claudeEntries: readonly HookEntry[];
  readonly codexEntries: readonly HookEntry[];
  readonly skill: string;
  readonly isReplacingSkill: boolean;
}

// The five files an install writes, in the order it reports them, each with a planner that turns
// the file's old text into its new text or a refusal.
export function buildInstallItems(inputs: InstallItemInputs): readonly InstallItem[] {
  const home = inputs.paths.home;
  const show = (path: string): string => formatDisplayPath(path, home);

  return [
    {
      path: inputs.paths.claudeSettings,
      shown: show(inputs.paths.claudeSettings),
      kind: 'settings',
      newMode: 0o600,
      plan: (before) =>
        planClaudeSettings(before, inputs.claudeEntries, show(inputs.paths.claudeSettings)),
    },
    {
      path: inputs.paths.codexHooks,
      shown: show(inputs.paths.codexHooks),
      kind: 'hooks',
      newMode: 0o600,
      plan: (before) => planCodexHooks(before, inputs.codexEntries, show(inputs.paths.codexHooks)),
    },
    {
      path: inputs.paths.codexRules,
      shown: show(inputs.paths.codexRules),
      kind: 'rules',
      newMode: 0o644,
      plan: (before) => planRulesFile(before, show(inputs.paths.codexRules)),
    },
    {
      path: inputs.paths.claudeSkill,
      shown: show(inputs.paths.claudeSkill),
      kind: 'skill',
      newMode: 0o644,
      plan: (before) =>
        planSkillFile(
          before,
          inputs.skill,
          show(inputs.paths.claudeSkill),
          inputs.isReplacingSkill,
        ),
    },
    {
      path: inputs.paths.codexSkill,
      shown: show(inputs.paths.codexSkill),
      kind: 'skill',
      newMode: 0o644,
      plan: (before) =>
        planSkillFile(before, inputs.skill, show(inputs.paths.codexSkill), inputs.isReplacingSkill),
    },
  ];
}
