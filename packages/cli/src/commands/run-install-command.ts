import { existsSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { readBinPath } from '../hooks/read-bin-path.ts';
import { buildHookEntries } from '../install/build-hook-entries.ts';
import { buildInstallItems } from '../install/build-install-items.ts';
import type { InstallItem } from '../install/build-install-items.ts';
import { findHomePaths } from '../install/find-home-paths.ts';
import { formatCheckLimits } from '../install/format-check-limits.ts';
import { formatConfigLines } from '../install/format-config-lines.ts';
import { formatDisplayPath } from '../install/format-display-path.ts';
import { formatInstallPrint } from '../install/format-install-print.ts';
import { readCheckLimits } from '../install/read-check-limits.ts';
import { readTextOrNull } from '../install/read-text-or-null.ts';
import { refuseInstall } from '../install/refuse-install.ts';
import type { FilePlan } from '../install/types.ts';
import { writeInstalledFile } from '../install/write-installed-file.ts';
import type { InstallWriteSeam } from '../install/write-installed-file.ts';
import { readSkillMark } from '../skill/read-skill-mark.ts';
import { renderSkill } from '../skill/render-skill.ts';
import { findStoreRoot } from '../store/find-store-root.ts';
import type { CommandResult } from '../types.ts';

export interface InstallContext {
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly cwd: string;
  readonly isPrinting: boolean;
  readonly isReplacingSkill: boolean;

  // the version `www --version` prints, which the skill's mark names
  readonly version: string;
  readonly seam?: InstallWriteSeam;
}

// Writes the hook entries, the allow rules and the www skill into the user's own files, or prints
// them. It refuses before it writes anything when a file is not one it can edit safely, so a
// refusal leaves every file as it was.
export function runInstallCommand(context: InstallContext): CommandResult {
  const paths = findHomePaths(context.env);
  const bin = readBinPath(context.env, context.cwd);

  if (paths === null) {
    return refuseInstall(
      context.cwd,
      ['www: install finds no HOME in its environment, so it cannot find a settings file.'],
      [{ www: ['install', '--print'] }],
    );
  }

  if (bin === null) {
    return refuseInstall(
      context.cwd,
      ['www: install finds no wherewerewe on PATH, and each hook entry runs it by its path.'],
      [{ shell: ['brew', 'install', 'zgeoff/tap/wherewerewe'] }],
    );
  }

  const items = buildInstallItems({
    paths,
    claudeEntries: buildHookEntries('claude', bin),
    codexEntries: buildHookEntries('codex', bin),
    skill: renderSkill(context.version),
    isReplacingSkill: context.isReplacingSkill,
  });

  const storeRoot =
    findStoreRoot(context.env) ?? join(paths.home, '.local', 'state', 'wherewerewe');

  const shownConfig = formatDisplayPath(paths.codexConfig, paths.home);
  const limits = formatCheckLimits(readCheckLimits(context.env, context.cwd, paths.home));

  if (context.isPrinting) {
    return text(`${formatInstallPrint(items, shownConfig, storeRoot)}\n${limits}`);
  }

  const refused = items.find((item) => item.plan(readTextOrNull(item.path)).kind === 'refused');

  if (refused !== undefined) {
    return refuseItem(context, refused, readTextOrNull(refused.path));
  }

  return writeItems(context, items, `${limits}${formatConfigLines(shownConfig, storeRoot)}`);
}

function text(stdout: string): CommandResult {
  return { exitCode: 0, stdout, stderr: '', stdoutFormat: 'text' };
}

function refuseItem(
  context: InstallContext,
  item: InstallItem,
  before: string | null,
): CommandResult {
  const plan = item.plan(before);
  const reason = plan.kind === 'refused' ? plan.reason : 'unreadable';

  if (reason === 'foreign-rules') {
    return refuseInstall(
      context.cwd,
      [`www: ${item.shown} holds rules that www install did not write, so install leaves it.`],
      [{ www: ['install', '--print'] }],
    );
  }

  if (reason === 'foreign-skill') {
    return refuseInstall(
      context.cwd,
      [
        `www: ${item.shown} holds a www skill that www install did not write, or one edited since, so install leaves it.`,
      ],
      [{ www: ['install', '--replace-skill'] }],
    );
  }

  return refuseInstall(
    context.cwd,
    [`www: install cannot read ${item.shown} as JSON settings, so it changes nothing.`],
    [{ www: ['install', '--print'] }],
  );
}

function writeItems(
  context: InstallContext,
  items: readonly InstallItem[],
  config: string,
): CommandResult {
  const lines: string[] = [];

  for (const item of items) {
    const moved = moveForeignSkill(context, item);

    lines.push(...moved);

    let used: FilePlan = { kind: 'refused', reason: 'unreadable' };

    const result = writeInstalledFile(
      {
        path: item.path,
        newMode: item.newMode,
        plan: (before) => {
          used = item.plan(before);

          return planText(used);
        },
      },
      context.seam ?? {},
    );

    if (result.kind === 'changed') {
      return {
        ...refuseInstall(
          context.cwd,
          [`www: ${item.shown} changed while install ran, so it changes nothing there.`],
          [{ www: ['install'] }],
        ),
        stdout: lines.map((line) => `${line}\n`).join(''),
      };
    }

    lines.push(...describeWrite(used, item, result));
  }

  return text(`${lines.join('\n')}\n${config}`);
}

// With --replace-skill, a skill file that this tool did not write, or one edited since, moves to
// `SKILL.md.replaced` in its folder, over an older one, before the new file goes in.
function moveForeignSkill(context: InstallContext, item: InstallItem): string[] {
  const before = readTextOrNull(item.path);

  if (!context.isReplacingSkill || item.kind !== 'skill' || before === null) {
    return [];
  }

  const mark = readSkillMark(before);

  if (mark?.bodyMatches === true) {
    return [];
  }

  const replaced = `${item.path}.replaced`;

  if (existsSync(replaced)) {
    rmSync(replaced, { force: true });
  }

  renameSync(item.path, replaced);

  return [`www install: moved ${item.shown} to ${item.shown}.replaced`];
}

function planText(plan: FilePlan): string | null {
  return plan.kind === 'text' ? plan.text : null;
}

function describeWrite(
  plan: FilePlan,
  item: InstallItem,
  result: ReturnType<typeof writeInstalledFile>,
): string[] {
  if (plan.kind !== 'text') {
    return [];
  }

  if (result.kind === 'unchanged') {
    return [plan.sameLine];
  }

  const backup =
    result.kind === 'written' && result.backup !== null
      ? ` The old file is kept at ${item.shown}.www-backup.`
      : '';

  return [...plan.notices, `${plan.changedLine}${backup}`];
}
