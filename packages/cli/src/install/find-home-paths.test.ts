import { expect, test } from 'bun:test';
import { findHomePaths } from './find-home-paths.ts';

function setupTest() {
  return { paths: findHomePaths };
}

test('it puts each file under the home folder by default', () => {
  const ctx = setupTest();

  expect(ctx.paths({ HOME: '/home/sam' })).toStrictEqual({
    home: '/home/sam',
    claudeSettings: '/home/sam/.claude/settings.json',
    claudeSkill: '/home/sam/.claude/skills/www/SKILL.md',
    codexHome: '/home/sam/.codex',
    codexHooks: '/home/sam/.codex/hooks.json',
    codexRules: '/home/sam/.codex/rules/wherewerewe.rules',
    codexConfig: '/home/sam/.codex/config.toml',
    codexSkill: '/home/sam/.agents/skills/www/SKILL.md',
  });
});

test('it moves the Claude Code files, skill included, with CLAUDE_CONFIG_DIR', () => {
  const ctx = setupTest();
  const paths = ctx.paths({ HOME: '/home/sam', CLAUDE_CONFIG_DIR: '/data/claude' });

  expect([paths?.claudeSettings, paths?.claudeSkill, paths?.codexHooks]).toStrictEqual([
    '/data/claude/settings.json',
    '/data/claude/skills/www/SKILL.md',
    '/home/sam/.codex/hooks.json',
  ]);
});

test('it moves the Codex files with CODEX_HOME and keeps the Codex skill under the home folder', () => {
  const ctx = setupTest();
  const paths = ctx.paths({ HOME: '/home/sam', CODEX_HOME: '/data/codex' });

  expect([
    paths?.codexHooks,
    paths?.codexRules,
    paths?.codexConfig,
    paths?.codexSkill,
  ]).toStrictEqual([
    '/data/codex/hooks.json',
    '/data/codex/rules/wherewerewe.rules',
    '/data/codex/config.toml',
    '/home/sam/.agents/skills/www/SKILL.md',
  ]);
});

test.each([{ env: {} }, { env: { HOME: '' } }])('it gives null with no home in $env', (row) => {
  const ctx = setupTest();

  expect(ctx.paths(row.env)).toBeNull();
});

test('it ignores an empty CLAUDE_CONFIG_DIR', () => {
  const ctx = setupTest();

  expect(ctx.paths({ HOME: '/h', CLAUDE_CONFIG_DIR: '' })?.claudeSettings).toBe(
    '/h/.claude/settings.json',
  );
});
