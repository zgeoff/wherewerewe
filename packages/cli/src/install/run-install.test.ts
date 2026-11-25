import { expect, test } from 'bun:test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { createTestHome } from '../test-utils/create-test-home.ts';

function setupTest() {
  return createTestHome();
}

test('it writes the hook entries, the allow rules, the Codex rule and both skills into a fresh home', async () => {
  const ctx = setupTest();

  await ctx.www(['install']);

  const claudeText = await readFile(join(ctx.home, '.claude/settings.json'), 'utf8');
  const codexText = await readFile(join(ctx.home, '.codex/hooks.json'), 'utf8');
  const rules = await readFile(join(ctx.home, '.codex/rules/wherewerewe.rules'), 'utf8');
  const claudeSkill = await readFile(join(ctx.home, '.claude/skills/www/SKILL.md'), 'utf8');
  const agentsSkill = await readFile(join(ctx.home, '.agents/skills/www/SKILL.md'), 'utf8');

  const claude: unknown = JSON.parse(claudeText);
  const codex: unknown = JSON.parse(codexText);

  expect({
    claude,
    codex,
    rules,
    skills: [
      claudeSkill.includes('written-by: wherewerewe 9.9.9'),
      agentsSkill.includes('written-by: wherewerewe 9.9.9'),
    ],
  }).toStrictEqual({
    claude: {
      hooks: {
        SessionStart: [
          { hooks: [{ type: 'command', command: '/opt/bin/wherewerewe hook claude', timeout: 5 }] },
        ],
        PreToolUse: [
          { hooks: [{ type: 'command', command: '/opt/bin/wherewerewe hook claude', timeout: 3 }] },
        ],
      },
      permissions: { allow: ['Bash(www *)', 'Bash(wherewerewe *)'] },
    },
    codex: {
      hooks: {
        SessionStart: [
          { hooks: [{ type: 'command', command: '/opt/bin/wherewerewe hook codex', timeout: 5 }] },
        ],
        PreToolUse: [
          { hooks: [{ type: 'command', command: '/opt/bin/wherewerewe hook codex', timeout: 3 }] },
        ],
      },
    },
    rules:
      'prefix_rule(pattern = ["www"], decision = "allow")\nprefix_rule(pattern = ["wherewerewe"], decision = "allow")\n',
    skills: [true, true],
  });
});

test('it keeps what the owner had, drops the entries of an older version and backs the file up', async () => {
  const ctx = setupTest();

  const before = {
    model: 'harbour-1',
    permissions: { allow: ['Bash(ls *)'], deny: ['Bash(rm *)'] },
    hooks: {
      PreToolUse: [
        { hooks: [{ type: 'command', command: 'tide-lint', timeout: 2 }] },
        { hooks: [{ type: 'command', command: '/opt/bin/wherewerewe hook claude', timeout: 3 }] },
      ],
      Stop: [
        { hooks: [{ type: 'command', command: '/opt/bin/wherewerewe hook claude', timeout: 3 }] },
      ],
      PostToolUse: [
        {
          matcher: 'Bash',
          hooks: [{ type: 'command', command: '/old/bin/wherewerewe hook claude' }],
        },
      ],
    },
  };

  await mkdir(join(ctx.home, '.claude'), { recursive: true });
  await writeFile(join(ctx.home, '.claude/settings.json'), JSON.stringify(before));

  await ctx.www(['install']);

  const afterText = await readFile(join(ctx.home, '.claude/settings.json'), 'utf8');
  const backupText = await readFile(join(ctx.home, '.claude/settings.json.www-backup'), 'utf8');

  const after: unknown = JSON.parse(afterText);
  const backup: unknown = JSON.parse(backupText);

  expect({ after, backup }).toStrictEqual({
    after: {
      model: 'harbour-1',
      permissions: {
        allow: ['Bash(ls *)', 'Bash(www *)', 'Bash(wherewerewe *)'],
        deny: ['Bash(rm *)'],
      },
      hooks: {
        PreToolUse: [
          { hooks: [{ type: 'command', command: 'tide-lint', timeout: 2 }] },
          { hooks: [{ type: 'command', command: '/opt/bin/wherewerewe hook claude', timeout: 3 }] },
        ],
        SessionStart: [
          { hooks: [{ type: 'command', command: '/opt/bin/wherewerewe hook claude', timeout: 5 }] },
        ],
      },
    },
    backup: before,
  });
});

test('it changes no file on a second run', async () => {
  const ctx = setupTest();

  await ctx.www(['install']);

  const first = await readFile(join(ctx.home, '.claude/settings.json'), 'utf8');
  const reply = await ctx.json(['install']);
  const second = await readFile(join(ctx.home, '.claude/settings.json'), 'utf8');

  const steps = z.array(z.object({ detail: z.string() })).parse(reply);

  expect({
    isSame: second === first,
    details: steps.slice(0, 5).map((step) => step.detail),
  }).toStrictEqual({ isSame: true, details: Array.from({ length: 5 }, () => 'already set') });
});

test('it writes nothing with --print', async () => {
  const ctx = setupTest();

  await ctx.www(['install', '--print']);

  const settings = await readFile(join(ctx.home, '.claude/settings.json'), 'utf8').catch(
    () => null,
  );

  expect(settings).toBeNull();
});

test('it leaves a settings file it cannot read and a skill it did not write', async () => {
  const ctx = setupTest();

  await mkdir(join(ctx.home, '.claude/skills/www'), { recursive: true });
  await writeFile(join(ctx.home, '.claude/settings.json'), '{ not json');
  await writeFile(join(ctx.home, '.claude/skills/www/SKILL.md'), 'my own notes\n');

  await ctx.www(['install']);

  const settings = await readFile(join(ctx.home, '.claude/settings.json'), 'utf8');
  const skill = await readFile(join(ctx.home, '.claude/skills/www/SKILL.md'), 'utf8');

  expect([settings, skill]).toStrictEqual(['{ not json', 'my own notes\n']);
});

test('it replaces a skill an older version wrote', async () => {
  const ctx = setupTest();

  await mkdir(join(ctx.home, '.claude/skills/www'), { recursive: true });

  await writeFile(
    join(ctx.home, '.claude/skills/www/SKILL.md'),
    '---\nmetadata:\n  written-by: wherewerewe 0.1.0\n---\nold\n',
  );

  await ctx.www(['install']);

  const skill = await readFile(join(ctx.home, '.claude/skills/www/SKILL.md'), 'utf8');

  expect(skill).toContain('written-by: wherewerewe 9.9.9');
});
