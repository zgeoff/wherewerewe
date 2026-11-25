import { expect, test } from 'bun:test';
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { buildHookEntries } from '../install/build-hook-entries.ts';
import type { InstallWriteSeam } from '../install/write-installed-file.ts';
import { renderSkill } from '../skill/render-skill.ts';
import { buildCredentialSamples } from '../test-utils/build-credential-samples.ts';
import { isSubsequence } from '../test-utils/is-subsequence.ts';
import { parseSettingsJson } from '../test-utils/parse-settings-json.ts';
import { readFolderHash } from '../test-utils/read-folder-hash.ts';
import { seedInstallFixture } from '../test-utils/seed-install-fixture.ts';
import { seedStubCommand } from '../test-utils/seed-stub-command.ts';
import { runInstallCommand } from './run-install-command.ts';

function setupTest() {
  const fixture = seedInstallFixture();
  const events: string[] = [];

  return {
    ...fixture,
    stopgap: '---\nname: www\ndescription: "Keeps what is true."\n---\n\n# www\n\nRun `www`.\n',
    read: (path: string) => readFileSync(path, 'utf8'),
    place: (path: string, text: string) => {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, text);
    },
    mode: (path: string) => statSync(path).mode % 0o1000,
    hash: () => readFolderHash(fixture.root),
    install: (flags: readonly string[] = []) => fixture.run(['install', ...flags]),
    events,
    runWith: (seam: InstallWriteSeam) =>
      runInstallCommand({
        env: fixture.env,
        cwd: fixture.work,
        isPrinting: false,
        isReplacingSkill: false,
        version: '0.0.1',
        emit: (text) => {
          events.push(text);
        },
        seam,
      }),
    skill: renderSkill('0.0.1'),
  };
}

test('it writes the hook entries, the allow rules and the skills of a fresh home, and prints each file', async () => {
  const ctx = setupTest();

  const result = await ctx.install();

  const claude = parseSettingsJson(ctx.read(ctx.paths.claudeSettings));
  const codex = parseSettingsJson(ctx.read(ctx.paths.codexHooks));

  expect({
    exitCode: result.exitCode,
    claude: Object.keys(claude.hooks),
    codex: Object.keys(codex.hooks),
    allow: claude.permissions.allow,
    rules: ctx.read(ctx.paths.codexRules),
    claudeSkill: ctx.read(ctx.paths.claudeSkill) === ctx.skill,
    codexSkill: ctx.read(ctx.paths.codexSkill) === ctx.skill,
  }).toStrictEqual({
    exitCode: 0,
    claude: [
      'SessionStart',
      'PreToolUse',
      'PostToolUse',
      'PostToolUseFailure',
      'SubagentStart',
      'Stop',
    ],
    codex: ['SessionStart', 'PreToolUse', 'PostToolUse', 'SubagentStart', 'Stop'],
    allow: ['Bash(www *)'],
    rules: 'prefix_rule(pattern = ["www"], decision = "allow")\n',
    claudeSkill: true,
    codexSkill: true,
  });
});

test('it names the rule and the file before it writes each allow rule', async () => {
  const ctx = setupTest();

  const result = await ctx.install();

  expect(result.stdout).toContain(
    'www install: adding "Bash(www *)" to permissions.allow in ~/.claude/settings.json\n',
  );

  expect(result.stdout).toContain(
    'www install: adding prefix_rule(pattern = ["www"], decision = "allow") to ~/.codex/rules/wherewerewe.rules\n',
  );
});

test('it names each hook entry path as the binary on the PATH, with no runtime', async () => {
  const ctx = setupTest();

  await ctx.install();

  const entries = buildHookEntries('claude', join(ctx.bin, 'wherewerewe'));
  const settings = parseSettingsJson(ctx.read(ctx.paths.claudeSettings));

  expect(settings.hooks.Stop?.[0]?.hooks[0]?.command).toBe(entries[5]?.command);
});

test('it prints the lines that config.toml needs, with the store root as an absolute path, and never edits it', async () => {
  const ctx = setupTest();

  const result = await ctx.install();

  expect({
    lines: result.stdout.split('\n').slice(-6),
    hasConfig: existsSync(ctx.paths.codexConfig),
  }).toStrictEqual({
    lines: [
      '[features]',
      'hooks = true',
      '',
      '[sandbox_workspace_write]',
      `writable_roots = ["${ctx.storeRoot}"]`,
      '',
    ],
    hasConfig: false,
  });
});

test('it changes no file on a second run and says so for each one', async () => {
  const ctx = setupTest();

  await ctx.install();

  const before = ctx.hash();

  const second = await ctx.install();

  expect({ exitCode: second.exitCode, isSame: ctx.hash() === before }).toStrictEqual({
    exitCode: 0,
    isSame: true,
  });

  expect(second.stdout.match(/nothing changed/gu)).toHaveLength(5);
});

test('it keeps the bytes of other keys, hooks and rules and adds only its own', async () => {
  const ctx = setupTest();
  const original = `{\n\t"model": "opus",\n\t"permissions": {\n\t\t"allow": [ "Bash(git status)" ],\n\t\t"deny": [ "Read(.env)" ]\n\t},\n\t"hooks": {\n\t\t"Stop": [ { "hooks": [ { "type": "command", "command": "~/bin/notify.sh", "timeout": 5 } ] } ]\n\t}\n}\n`;

  ctx.place(ctx.paths.claudeSettings, original);

  await ctx.install();

  expect(isSubsequence(original, ctx.read(ctx.paths.claudeSettings))).toBe(true);
});

test('it replaces an older entry that ran bun on the bin, where it stands', async () => {
  const ctx = setupTest();
  const old = `{"hooks":{"Stop":[{"hooks":[{"type":"command","command":"/usr/bin/bun /usr/local/bin/wherewerewe hook claude","timeout":3}]}]}}`;

  ctx.place(ctx.paths.claudeSettings, old);

  await ctx.install();

  expect(parseSettingsJson(ctx.read(ctx.paths.claudeSettings)).hooks.Stop).toStrictEqual([
    { hooks: [{ type: 'command', command: `${ctx.bin}/wherewerewe hook claude`, timeout: 3 }] },
  ]);
});

test('it writes both hook files byte for byte the same when the binary at the same path is another version', async () => {
  const ctx = setupTest();

  await ctx.install();

  const before = [ctx.read(ctx.paths.claudeSettings), ctx.read(ctx.paths.codexHooks)];

  writeFileSync(join(ctx.bin, 'wherewerewe'), 'binary-stub-of-another-version');

  const second = await ctx.install();

  expect({
    after: [ctx.read(ctx.paths.claudeSettings), ctx.read(ctx.paths.codexHooks)],
    exitCode: second.exitCode,
  }).toStrictEqual({ after: before, exitCode: 0 });
});

test('it changes nothing with --print, and prints the blocks, the rules, the skills and the config lines', async () => {
  const ctx = setupTest();
  const before = ctx.hash();

  const result = await ctx.install(['--print']);

  expect(ctx.hash()).toBe(before);
  expect(result.stdout).toContain('"PostToolUseFailure"');
  expect(result.stdout).toContain('prefix_rule(pattern = ["www"], decision = "allow")');
  expect(result.stdout).toContain('~/.claude/skills/www/SKILL.md');
  expect(result.stdout).toContain('~/.agents/skills/www/SKILL.md');
  expect(result.stdout).toContain('hooks = true');
});

test('it writes the Claude Code files under CLAUDE_CONFIG_DIR and the Codex files under CODEX_HOME', async () => {
  const ctx = setupTest();
  const claude = join(ctx.root, 'claude-elsewhere');
  const codex = join(ctx.root, 'codex-elsewhere');

  await ctx.run(['install'], { CLAUDE_CONFIG_DIR: claude, CODEX_HOME: codex });

  expect({
    settings: existsSync(join(claude, 'settings.json')),
    skill: existsSync(join(claude, 'skills', 'www', 'SKILL.md')),
    hooks: existsSync(join(codex, 'hooks.json')),
    rules: existsSync(join(codex, 'rules', 'wherewerewe.rules')),
    homeHasClaude: existsSync(join(ctx.home, '.claude')),
    homeHasCodex: existsSync(join(ctx.home, '.codex')),
    codexSkill: existsSync(ctx.paths.codexSkill),
  }).toStrictEqual({
    settings: true,
    skill: true,
    hooks: true,
    rules: true,
    homeHasClaude: false,
    homeHasCodex: false,
    codexSkill: true,
  });
});

test('it creates a settings file with mode 0600, keeps an existing file mode, and names the backup', async () => {
  const ctx = setupTest();

  ctx.place(ctx.paths.codexHooks, '{}\n');

  chmodSync(ctx.paths.codexHooks, 0o640);

  const result = await ctx.install();

  expect({
    claudeMode: ctx.mode(ctx.paths.claudeSettings),
    codexMode: ctx.mode(ctx.paths.codexHooks),
    backup: ctx.read(`${ctx.paths.codexHooks}.www-backup`),
    backupMode: ctx.mode(`${ctx.paths.codexHooks}.www-backup`),
    hasBackupLine: result.stdout.includes('~/.codex/hooks.json.www-backup'),
  }).toStrictEqual({
    claudeMode: 0o600,
    codexMode: 0o640,
    backup: '{}\n',
    backupMode: 0o640,
    hasBackupLine: true,
  });
});

test('it writes to the target of a settings file that is a link and keeps the link', async () => {
  const ctx = setupTest();
  const target = join(ctx.root, 'dotfiles', 'settings.json');

  ctx.place(target, '{"model": "opus"}\n');

  mkdirSync(dirname(ctx.paths.claudeSettings), { recursive: true });
  symlinkSync(target, ctx.paths.claudeSettings);

  await ctx.install();

  expect({
    isLink: lstatSync(ctx.paths.claudeSettings).isSymbolicLink(),
    holdsHooks: ctx.read(target).includes('"PreToolUse"'),
  }).toStrictEqual({ isLink: true, holdsHooks: true });
});

test('it keeps both writes when the file changes between its read and its rename', () => {
  const ctx = setupTest();

  ctx.place(ctx.paths.claudeSettings, '{\n  "model": "opus"\n}\n');

  const result = ctx.runWith({
    beforeRename: (path) => {
      if (path === ctx.paths.claudeSettings) {
        writeFileSync(path, '{\n  "model": "opus",\n  "theme": "dark"\n}\n');
      }
    },
  });

  const written = parseSettingsJson(ctx.read(ctx.paths.claudeSettings));

  expect({
    exitCode: result.exitCode,
    theme: written.theme,
    hasHooks: 'hooks' in written,
  }).toStrictEqual({
    exitCode: 0,
    theme: 'dark',
    hasHooks: true,
  });
});

test('it never says nothing was written when a later file changes on each try after an earlier one was written', () => {
  const ctx = setupTest();
  let tries = 0;

  ctx.place(ctx.paths.claudeSettings, '{\n  "model": "opus"\n}\n');

  const result = ctx.runWith({
    beforeRename: (path) => {
      if (path === ctx.paths.codexHooks) {
        tries += 1;

        writeFileSync(path, `{"hooks": {}, "try": ${String(tries)}}\n`);
      }
    },
  });

  expect({
    exitCode: result.exitCode,
    claudeHasHooks: 'hooks' in parseSettingsJson(ctx.read(ctx.paths.claudeSettings)),
    saysNothingWritten: result.stderr.includes('nothing was written'),
    saysChanged: result.stderr.includes('changed while install ran'),
  }).toStrictEqual({
    exitCode: 3,
    claudeHasHooks: true,
    saysNothingWritten: false,
    saysChanged: true,
  });
});

test('it finishes an install that a changed file stopped part way when run again', async () => {
  const ctx = setupTest();

  ctx.runWith({
    beforeRename: (path) => {
      if (path === ctx.paths.codexHooks) {
        writeFileSync(path, `{"hooks": {}, "stamp": ${String(Date.now())}}\n`);
      }
    },
  });

  const rerun = await ctx.install();

  expect({
    exitCode: rerun.exitCode,
    claudeHasHooks: 'hooks' in parseSettingsJson(ctx.read(ctx.paths.claudeSettings)),
    codexHasEntries: ctx.read(ctx.paths.codexHooks).includes('wherewerewe hook codex'),
  }).toStrictEqual({ exitCode: 0, claudeHasHooks: true, codexHasEntries: true });
});

test('it says what it adds and the limits that apply before it changes any file', () => {
  const ctx = setupTest();

  ctx.place(ctx.paths.claudeSettings, '{\n  "model": "opus"\n}\n');

  const startHash = ctx.hash();
  const hashesAtEmit: string[] = [];

  runInstallCommand({
    env: ctx.env,
    cwd: ctx.work,
    isPrinting: false,
    isReplacingSkill: false,
    version: '0.0.1',
    emit: (text) => {
      ctx.events.push(text);
      hashesAtEmit.push(ctx.hash());
    },
  });

  expect({ events: ctx.events, hashesAtEmit }).toStrictEqual({
    events: [
      expect.stringContaining('with the allow rules, a check runs git and gh with no prompt'),
      'www install: adding "Bash(www *)" to permissions.allow in ~/.claude/settings.json\n',
      'www install: adding prefix_rule(pattern = ["www"], decision = "allow") to ~/.codex/rules/wherewerewe.rules\n',
    ],
    hashesAtEmit: [startHash, startHash, startHash],
  });
});

test('it has printed the limits when a later file changes while it runs, and the refusal names the earlier write', () => {
  const ctx = setupTest();
  let count = 0;

  const result = ctx.runWith({
    beforeRename: (path) => {
      if (path === ctx.paths.codexHooks) {
        count += 1;

        writeFileSync(path, `{ "hooks": {}, "touched": ${String(count)} }\n`);
      }
    },
  });

  expect({
    exitCode: result.exitCode,
    printed: ctx.events.some((event) => event.includes('a check runs git and gh with no prompt')),
    stderr: result.stderr.split('\n')[0],
    claudeWritten: existsSync(ctx.paths.claudeSettings),
  }).toStrictEqual({
    exitCode: 3,
    printed: true,
    stderr: 'www: ~/.codex/hooks.json changed while install ran, so it changes nothing there.',
    claudeWritten: true,
  });
});

test('it refuses a settings file it cannot read, and writes nothing', async () => {
  const ctx = setupTest();

  ctx.place(ctx.paths.claudeSettings, '{}\n');

  const before = ctx.hash();
  const mode = ctx.mode(ctx.paths.claudeSettings);

  chmodSync(ctx.paths.claudeSettings, 0o000);

  const result = await ctx.install();

  chmodSync(ctx.paths.claudeSettings, mode);

  expect({
    exitCode: result.exitCode,
    stderr: result.stderr.split('\n')[0],
    unchanged: ctx.hash() === before,
  }).toStrictEqual({
    exitCode: 3,
    stderr: 'www: install cannot read ~/.claude/settings.json, so it changes nothing there.',
    unchanged: true,
  });
});

test('it fails when a file turns invalid between the preflight and the write', () => {
  const ctx = setupTest();

  ctx.place(ctx.paths.claudeSettings, '{}\n');

  const result = ctx.runWith({
    beforeRename: (path) => {
      if (path === ctx.paths.claudeSettings) {
        writeFileSync(path, '{ "hooks": ');
      }
    },
  });

  expect({
    exitCode: result.exitCode,
    stderr: result.stderr.split('\n')[0],
    text: ctx.read(ctx.paths.claudeSettings),
  }).toStrictEqual({
    exitCode: 3,
    stderr:
      'www: install cannot read ~/.claude/settings.json as JSON settings, so it changes nothing.',
    text: '{ "hooks": ',
  });
});

test('it refuses with exit 3 when no wherewerewe is on the PATH, and writes nothing', async () => {
  const ctx = setupTest();
  const before = ctx.hash();

  const result = await ctx.run(['install'], { PATH: join(ctx.root, 'nowhere') });

  expect({
    exitCode: result.exitCode,
    stderr: result.stderr,
    isSame: ctx.hash() === before,
  }).toStrictEqual({
    exitCode: 3,
    stderr:
      'www: install finds no wherewerewe on PATH, and each hook entry runs it by its path.\nRun: brew install zgeoff/tap/wherewerewe  # nothing was written\n',
    isSame: true,
  });
});

test('it never names a wherewerewe from a relative PATH entry or the working folder', async () => {
  const ctx = setupTest();
  const planted = join(ctx.work, 'bin');

  mkdirSync(planted);
  writeFileSync(join(planted, 'wherewerewe'), 'planted');
  chmodSync(join(planted, 'wherewerewe'), 0o755);

  await ctx.run(['install'], { PATH: ['bin', planted, ctx.bin].join(':') });

  expect(ctx.read(ctx.paths.claudeSettings)).toContain(`${ctx.bin}/wherewerewe hook claude`);
  expect(ctx.read(ctx.paths.claudeSettings)).not.toContain(planted);
});

test.each([
  { title: 'a comment', text: '{ // a note\n "model": "opus" }' },
  { title: 'a trailing comma', text: '{"model": "opus",}' },
  { title: 'a top level that is not an object', text: '["x"]' },
  { title: 'hooks that is a list', text: '{"hooks": []}' },
  { title: 'an event list that is an object', text: '{"hooks": {"Stop": {}}}' },
  { title: 'permissions that is a string', text: '{"permissions": "all"}' },
  { title: 'permissions.allow that is an object', text: '{"permissions": {"allow": {}}}' },
])(
  'it refuses a Claude Code settings file with $title and writes nothing in either home',
  async (row) => {
    const ctx = setupTest();

    ctx.place(ctx.paths.claudeSettings, row.text);

    const before = ctx.hash();

    const result = await ctx.install();

    expect({
      exitCode: result.exitCode,
      stderr: result.stderr,
      isSame: ctx.hash() === before,
    }).toStrictEqual({
      exitCode: 3,
      stderr: `www: install cannot read ~/.claude/settings.json as JSON settings, so it changes nothing.\nRun: www install --print  # nothing was written\n`,
      isSame: true,
    });
  },
);

test('it refuses a Codex hooks file that is not JSON and writes nothing', async () => {
  const ctx = setupTest();

  ctx.place(ctx.paths.codexHooks, 'hooks = true');

  const before = ctx.hash();

  const result = await ctx.install();

  expect({ exitCode: result.exitCode, isSame: ctx.hash() === before }).toStrictEqual({
    exitCode: 3,
    isSame: true,
  });
});

test.each([
  { title: 'an extra rule', text: 'prefix_rule(pattern = ["git"], decision = "allow")\n' },
  {
    title: 'the rule with a comment',
    text: '# mine\nprefix_rule(pattern = ["www"], decision = "allow")\n',
  },
])('it refuses a rules file that holds $title and writes nothing anywhere', async (row) => {
  const ctx = setupTest();

  ctx.place(ctx.paths.codexRules, row.text);

  const before = ctx.hash();

  const result = await ctx.install();

  expect({
    exitCode: result.exitCode,
    stderr: result.stderr,
    isSame: ctx.hash() === before,
  }).toStrictEqual({
    exitCode: 3,
    stderr:
      'www: ~/.codex/rules/wherewerewe.rules holds rules that www install did not write, so install leaves it.\nRun: www install --print  # nothing was written\n',
    isSame: true,
  });
});

test('it leaves a rules file that holds exactly the rule as it is', async () => {
  const ctx = setupTest();

  ctx.place(ctx.paths.codexRules, 'prefix_rule(pattern = ["www"], decision = "allow")\n');

  const result = await ctx.install();

  expect(result.stdout).toContain(
    'www install: ~/.codex/rules/wherewerewe.rules already holds the rule; nothing changed.',
  );
});

test('it replaces a skill that an older version wrote and nobody edited', async () => {
  const ctx = setupTest();

  ctx.place(ctx.paths.claudeSkill, renderSkill('0.0.0'));

  await ctx.install();

  expect(ctx.read(ctx.paths.claudeSkill)).toBe(ctx.skill);
});

test.each([
  {
    title: 'a hand-written skill with no mark',
    text: '---\nname: www\ndescription: "Keeps what is true."\n---\n\n# www\n\nRun `www`.\n',
  },
  { title: 'a skill whose body was edited', text: `${renderSkill('0.0.1')}\nAlso do this.\n` },
])('it refuses $title, changes no file in either home and prints the Run line', async (row) => {
  const ctx = setupTest();

  ctx.place(ctx.paths.claudeSkill, row.text);

  const before = ctx.hash();

  const result = await ctx.install();

  expect({
    exitCode: result.exitCode,
    stderr: result.stderr,
    isSame: ctx.hash() === before,
  }).toStrictEqual({
    exitCode: 3,
    stderr:
      'www: ~/.claude/skills/www/SKILL.md holds a www skill that www install did not write, or one edited since, so install leaves it.\nRun: www install --replace-skill  # nothing was written\n',
    isSame: true,
  });
});

test('it moves a foreign skill to SKILL.md.replaced with --replace-skill, then writes the new one', async () => {
  const ctx = setupTest();

  ctx.place(ctx.paths.claudeSkill, ctx.stopgap);

  const result = await ctx.install(['--replace-skill']);

  expect({
    exitCode: result.exitCode,
    replaced: ctx.read(`${ctx.paths.claudeSkill}.replaced`),
    skill: ctx.read(ctx.paths.claudeSkill) === ctx.skill,
    hasMoveLine: result.stdout.includes(
      'www install: moved ~/.claude/skills/www/SKILL.md to ~/.claude/skills/www/SKILL.md.replaced\n',
    ),
  }).toStrictEqual({ exitCode: 0, replaced: ctx.stopgap, skill: true, hasMoveLine: true });
});

test('it replaces an older SKILL.md.replaced with --replace-skill', async () => {
  const ctx = setupTest();

  ctx.place(ctx.paths.claudeSkill, ctx.stopgap);
  ctx.place(`${ctx.paths.claudeSkill}.replaced`, 'older');

  await ctx.install(['--replace-skill']);

  expect(ctx.read(`${ctx.paths.claudeSkill}.replaced`)).toBe(ctx.stopgap);
});

test('it never prints a value from a settings file, in a run, a print or a refusal', async () => {
  const ctx = setupTest();
  const secret = buildCredentialSamples()[0]?.sample ?? '';

  ctx.place(ctx.paths.claudeSettings, `{"env": {"API_TOKEN": "${secret}"}}`);

  const run = await ctx.install();
  const print = await ctx.install(['--print']);

  ctx.place(ctx.paths.codexHooks, `{ "env": "${secret}", }`);

  const refusal = await ctx.install();

  const hasLog = existsSync(join(ctx.storeRoot, 'hook-errors.log'));

  expect({
    outputs: [run, print, refusal].map((result) =>
      `${result.stdout}${result.stderr}`.includes(secret.slice(0, 12)),
    ),
    hasLog,
    kept: ctx.read(ctx.paths.claudeSettings).includes(secret),
  }).toStrictEqual({ outputs: [false, false, false], hasLog: false, kept: true });
});

test('it prints the limits of the checks that apply here before the config lines, when it adds the allow rules', async () => {
  const ctx = setupTest();

  seedStubCommand(ctx.bin, 'git', 'echo "git version 2.30.1"');

  const result = await ctx.install();

  expect(result.stdout.split('\n').filter((line) => line.startsWith('- '))).toStrictEqual([
    '- a repo that adds a filter to its own config while a check runs can still run it once.',
    '- git 2.30.1 is older than 2.45, so a check leans on GIT_ALLOW_PROTOCOL alone to stop a lazy fetch.',
    '- git 2.30.1 is older than 2.36, so it reads core.fsmonitor=false as the name of a helper program.',
    `- ${ctx.bin} is on PATH and you can write to it, so a git or gh an agent plants there runs from a check.`,
    '- HOME names ~, which you can write to, so a git or gh config an agent writes there is read by a check.',
  ]);
});

test('it prints the same limits with --print, which writes nothing', async () => {
  const ctx = setupTest();

  seedStubCommand(ctx.bin, 'git', 'echo "git version 2.55.0"');

  const before = ctx.hash();

  const result = await ctx.install(['--print']);

  expect({
    same: ctx.hash() === before,
    limit: result.stdout.includes('- a repo that adds a filter'),
  }).toStrictEqual({
    same: true,
    limit: true,
  });
});
