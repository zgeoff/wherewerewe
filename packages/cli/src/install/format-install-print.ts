import type { InstallItem } from './build-install-items.ts';
import { formatConfigLines } from './format-config-lines.ts';

// What `www install --print` prints and writes nowhere: each file's new text as the wherewerewe
// blocks only, the rules, the skill files, and the `config.toml` lines. A file that cannot be
// planned prints nothing, so the user's own text never reaches the output.
export function formatInstallPrint(
  items: readonly InstallItem[],
  shownConfig: string,
  storeRoot: string,
): string {
  const blocks = items.map((item) => {
    const plan = item.plan(null);

    return plan.kind === 'text' ? `# ${item.shown}\n${plan.text}` : '';
  });

  return `${blocks.join('\n')}\n${formatConfigLines(shownConfig, storeRoot)}`;
}
