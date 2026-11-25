import { join } from 'node:path';
import { readBinPath } from '../hooks/read-bin-path.ts';
import { buildHookEntries } from '../install/build-hook-entries.ts';
import { checkAllowRule } from '../install/check-allow-rule.ts';
import { checkBinPath } from '../install/check-bin-path.ts';
import { checkCodexConfig } from '../install/check-codex-config.ts';
import { checkCodexRules } from '../install/check-codex-rules.ts';
import { checkDuplicateEntries } from '../install/check-duplicate-entries.ts';
import { checkEntryPaths } from '../install/check-entry-paths.ts';
import { checkGhAuth } from '../install/check-gh-auth.ts';
import { checkHookEntries } from '../install/check-hook-entries.ts';
import { checkSkillFile } from '../install/check-skill-file.ts';
import { checkStoreWritable } from '../install/check-store-writable.ts';
import { findHomePaths } from '../install/find-home-paths.ts';
import { formatDisplayPath } from '../install/format-display-path.ts';
import { getPackageVersion } from '../install/get-package-version.ts';
import { listEntryPaths } from '../install/list-entry-paths.ts';
import { readSafeProgram } from '../install/read-safe-program.ts';
import { readTextOrNull } from '../install/read-text-or-null.ts';
import type { DoctorCheck } from '../install/types.ts';
import { renderSkill } from '../skill/render-skill.ts';
import { findStoreRoot } from '../store/find-store-root.ts';
import type { CommandResult } from '../types.ts';

export interface DoctorContext {
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly cwd: string;
}

// Runs every check of the install without changing a setting, prints one block per check, `ok:`
// for a pass or the failing line and its fix, and exits 0 when all pass and 3 otherwise. It reads
// each layer of hooks a host reads, and prints no value of any file beyond what a line names.
export function runDoctorCommand(context: DoctorContext): CommandResult {
  const paths = findHomePaths(context.env);

  if (paths === null) {
    return report([
      {
        isOk: false,
        lines: ['www doctor: the environment names no HOME, so doctor finds no file.'],
      },
    ]);
  }

  const bin = readBinPath(context.env, context.cwd);
  const show = (path: string): string => formatDisplayPath(path, paths.home);

  const storeRoot =
    findStoreRoot(context.env) ?? join(paths.home, '.local', 'state', 'wherewerewe');

  const claudeText = readTextOrNull(paths.claudeSettings);
  const codexText = readTextOrNull(paths.codexHooks);
  const rendered = renderSkill(getPackageVersion());

  const projectLayers = (folder: string, files: readonly string[]) =>
    files.map((file) => ({
      shown: `${folder}/${file}`,
      format: file.endsWith('.toml') ? ('toml' as const) : ('json' as const),
      text: readTextOrNull(join(context.cwd, folder, file)),
    }));

  const checks = [
    checkBinPath(bin),
    checkHookEntries({
      harness: 'claude',
      shown: show(paths.claudeSettings),
      text: claudeText,
      entries: buildHookEntries('claude', bin ?? ''),
      bin,
    }),
    checkHookEntries({
      harness: 'codex',
      shown: show(paths.codexHooks),
      text: codexText,
      entries: buildHookEntries('codex', bin ?? ''),
      bin,
    }),
    checkEntryPaths(
      [...listEntryPaths(claudeText, 'claude'), ...listEntryPaths(codexText, 'codex')],
      bin,
    ),
    checkAllowRule(claudeText, show(paths.claudeSettings)),
    checkCodexRules({
      path: paths.codexRules,
      shown: show(paths.codexRules),
      text: readTextOrNull(paths.codexRules),
      codex: readSafeProgram('codex', context.env, context.cwd),
      env: context.env,
    }),
    checkCodexConfig(readTextOrNull(paths.codexConfig), show(paths.codexConfig), storeRoot),
    checkStoreWritable(storeRoot),
    checkGhAuth(readSafeProgram('gh', context.env, context.cwd), context.env),
    checkDuplicateEntries('claude', [
      { shown: show(paths.claudeSettings), format: 'json', text: claudeText },
      ...projectLayers('.claude', ['settings.json', 'settings.local.json']),
    ]),
    checkDuplicateEntries('codex', [
      { shown: show(paths.codexHooks), format: 'json', text: codexText },
      { shown: show(paths.codexConfig), format: 'toml', text: readTextOrNull(paths.codexConfig) },
      ...projectLayers('.codex', ['hooks.json', 'config.toml']),
    ]),
    checkSkillFile(readTextOrNull(paths.claudeSkill), rendered, show(paths.claudeSkill)),
    checkSkillFile(readTextOrNull(paths.codexSkill), rendered, show(paths.codexSkill)),
  ];

  return report(checks);
}

function report(checks: readonly DoctorCheck[]): CommandResult {
  return {
    exitCode: checks.every((check) => check.isOk) ? 0 : 3,
    stdout: checks.flatMap((check) => check.lines.map((line) => `${line}\n`)).join(''),
    stderr: '',
    stdoutFormat: 'text',
  };
}
