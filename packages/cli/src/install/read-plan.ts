import { renderSkill } from '../skill/render-skill.ts';
import { skillMark } from '../skill/skill-mark.ts';
import type { Context } from '../types.ts';
import { planJSON } from './plan-json.ts';
import { planText } from './plan-text.ts';
import { readPaths } from './read-paths.ts';
import type { Step } from './types.ts';
import { withAllowRules } from './with-allow-rules.ts';
import { withHooks } from './with-hooks.ts';

const codexRules =
  'prefix_rule(pattern = ["www"], decision = "allow")\nprefix_rule(pattern = ["wherewerewe"], decision = "allow")\n';

export function readPlan(context: Context): Promise<readonly Step[]> {
  const paths = readPaths(context.env);
  const bin = /\s/u.test(context.binaryPath) ? `"${context.binaryPath}"` : context.binaryPath;
  const skill = renderSkill(context.version);

  return Promise.all([
    planJSON(paths.claudeSettings, (settings) =>
      withAllowRules(withHooks(settings, 'claude', bin)),
    ),
    planJSON(paths.codexHooks, (settings) => withHooks(settings, 'codex', bin)),
    planText(paths.codexRules, codexRules, () => true),
    ...paths.skills.map((path) => planText(path, skill, (text) => text.includes(skillMark))),
  ]);
}
