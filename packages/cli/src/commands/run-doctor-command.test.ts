import { expect, test } from 'bun:test';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { renderSkill } from '../skill/render-skill.ts';
import { buildCredentialSamples } from '../test-utils/build-credential-samples.ts';
import { parseSettingsJson } from '../test-utils/parse-settings-json.ts';
import { readFolderHash } from '../test-utils/read-folder-hash.ts';
import { seedInstallFixture } from '../test-utils/seed-install-fixture.ts';
import { seedStubCommand } from '../test-utils/seed-stub-command.ts';

async function setupTest() {
  const fixture = seedInstallFixture();

  await fixture.run(['install']);

  mkdirSync(dirname(fixture.paths.codexConfig), { recursive: true });

  writeFileSync(
    fixture.paths.codexConfig,
    `[features]\nhooks = true\n\n[sandbox_workspace_write]\nwritable_roots = ["${fixture.storeRoot}"]\n`,
  );

  return {
    ...fixture,
    place: (path: string, text: string) => {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, text);
    },
    edit: (path: string, change: (text: string) => string) => {
      writeFileSync(path, change(readFileSync(path, 'utf8')));
    },
    doctor: (extraEnv: Readonly<Record<string, string>> = {}) => fixture.run(['doctor'], extraEnv),
    linesOf: (stdout: string) => stdout.split('\n').filter((line) => line !== ''),
  };
}

test('it passes every check of a home that install wrote, and exits 0', async () => {
  const ctx = await setupTest();
  const result = await ctx.doctor();

  const lines = ctx.linesOf(result.stdout);

  expect({
    exitCode: result.exitCode,
    failing: lines.filter((line) => !line.startsWith('ok:')),
    count: lines.length,
  }).toStrictEqual({ exitCode: 0, failing: [], count: 13 });
});

test('it writes no settings file, and leaves no probe file in the store root', async () => {
  const ctx = await setupTest();

  const before = readFolderHash(ctx.home);

  await ctx.doctor();

  expect(readFolderHash(ctx.home)).toBe(before);
  expect(readdirSync(ctx.storeRoot)).toStrictEqual([]);
});

test('it fails the PATH check with the install line when no wherewerewe is on the PATH', async () => {
  const ctx = await setupTest();
  const result = await ctx.doctor({ PATH: join(ctx.root, 'nowhere') });

  expect(result.exitCode).toBe(3);

  expect(result.stdout).toContain(
    'www doctor: no wherewerewe is on PATH, and each hook entry runs it by its path.\nRun: brew install zgeoff/tap/wherewerewe\n',
  );
});

test('it names the event and the fix for a Claude Code entry that is missing', async () => {
  const ctx = await setupTest();

  ctx.edit(ctx.paths.claudeSettings, (text) => {
    const settings = parseSettingsJson(text);

    delete settings.hooks.Stop;

    return JSON.stringify(settings, null, 2);
  });

  const result = await ctx.doctor();

  expect({ exitCode: result.exitCode, stdout: result.stdout }).toMatchObject({ exitCode: 3 });

  expect(result.stdout).toContain(
    'www doctor: ~/.claude/settings.json has no Stop entry for wherewerewe hook claude.\nRun: www install\n',
  );
});

test('it reports a Codex entry whose command changed, and says Codex asks for trust in /hooks', async () => {
  const ctx = await setupTest();

  ctx.edit(ctx.paths.codexHooks, (text) => text.replace(/"timeout": 3/u, '"timeout": 4'));

  const result = await ctx.doctor();

  expect(result.exitCode).toBe(3);

  expect(result.stdout).toContain(
    'is not the one that www install writes now.\nRun: www install\nCodex skips a changed hook until you trust it again in /hooks.\n',
  );
});

test('it reports the path of an entry whose binary is gone', async () => {
  const ctx = await setupTest();

  const second = join(ctx.root, 'second');

  mkdirSync(second);
  writeFileSync(join(second, 'wherewerewe'), 'binary-stub');
  chmodSync(join(second, 'wherewerewe'), 0o755);
  rmSync(join(ctx.bin, 'wherewerewe'));

  const result = await ctx.doctor({ PATH: [second, ctx.bin].join(':') });

  expect(result.stdout).toContain(
    `www doctor: the hooks run ${join(ctx.bin, 'wherewerewe')}, which is missing or not executable.\nRun: www install\n`,
  );
});

test('it reports a hook path that is a script, with the install line', async () => {
  const ctx = await setupTest();

  seedStubCommand(ctx.bin, 'wherewerewe', 'exit 0');

  const result = await ctx.doctor();

  expect(result.exitCode).toBe(3);

  expect(result.stdout).toContain(
    `www doctor: the hooks run ${join(ctx.bin, 'wherewerewe')}, a script that needs its interpreter on the hook's PATH.\nRun: www install\n`,
  );
});

test('it reports an entry path that is no longer the first wherewerewe on the PATH', async () => {
  const ctx = await setupTest();

  const first = join(ctx.root, 'first');

  mkdirSync(first);
  writeFileSync(join(first, 'wherewerewe'), 'binary-stub');
  chmodSync(join(first, 'wherewerewe'), 0o755);

  const result = await ctx.doctor({ PATH: [first, ctx.bin].join(':') });

  expect(result.stdout).toContain(
    `www doctor: the hooks run ${join(ctx.bin, 'wherewerewe')}, but the wherewerewe first on PATH is ${join(first, 'wherewerewe')}.\nRun: www install\n`,
  );
});

test('it reports a missing allow rule with the install line', async () => {
  const ctx = await setupTest();

  ctx.edit(ctx.paths.claudeSettings, (text) => {
    const settings = parseSettingsJson(text);

    settings.permissions.allow = [];

    return JSON.stringify(settings);
  });

  const result = await ctx.doctor();

  expect(result.stdout).toContain(
    'www doctor: no allow rule for www in ~/.claude/settings.json, so Claude Code asks before each www call.\nRun: www install\n',
  );
});

test.each([
  { list: 'deny', rule: 'Bash(www *)' },
  { list: 'ask', rule: 'Bash(*)' },
  { list: 'ask', rule: 'Bash(www)' },
  { list: 'deny', rule: 'Bash' },
])(
  'it reports a $list rule $rule that matches www by its place, never by its text',
  async (row) => {
    const ctx = await setupTest();

    ctx.edit(ctx.paths.claudeSettings, (text) => {
      const settings = parseSettingsJson(text);

      settings.permissions[row.list] = ['Bash(ls)', row.rule];

      return JSON.stringify(settings);
    });

    const result = await ctx.doctor();

    expect(result.stdout).toContain(
      `www doctor: rule 2 of permissions.${row.list} in ~/.claude/settings.json matches www, so Claude Code does not run it without asking.\n`,
    );

    expect(result.stdout).not.toContain(row.rule);
  },
);

test('it does not count a deny rule for another program', async () => {
  const ctx = await setupTest();

  ctx.edit(ctx.paths.claudeSettings, (text) => {
    const settings = parseSettingsJson(text);

    settings.permissions.deny = ['Bash(rm *)', 'Bash(wwwx *)'];

    return JSON.stringify(settings);
  });

  const result = await ctx.doctor();

  expect(result.exitCode).toBe(0);
});

test.each([
  {
    title: 'a missing file',
    text: null,
    expected: 'does not exist, so Codex does not allow www without asking.\nRun: www install\n',
  },
  {
    title: 'another rule',
    text: 'prefix_rule(pattern = ["git"], decision = "allow")\n',
    expected: 'is not the one rule that www install writes.\nRun: www install --print\n',
  },
])('it reports a rules file with $title', async (row) => {
  const ctx = await setupTest();

  if (row.text === null) {
    rmSync(ctx.paths.codexRules);
  } else {
    ctx.place(ctx.paths.codexRules, row.text);
  }

  const result = await ctx.doctor();

  expect(result.stdout).toContain(`www doctor: ~/.codex/rules/wherewerewe.rules ${row.expected}`);
});

test('it reports any decision other than allow that codex execpolicy check prints', async () => {
  const ctx = await setupTest();

  seedStubCommand(ctx.bin, 'codex', `echo '{"decision":"prompt"}'`);

  const result = await ctx.doctor();

  expect(result.exitCode).toBe(3);

  expect(result.stdout).toContain(
    'www doctor: Codex decides "prompt" for www with ~/.codex/rules/wherewerewe.rules, not "allow".\nRun: www install\n',
  );
});

test('it reports output of codex execpolicy check that holds no decision', async () => {
  const ctx = await setupTest();

  seedStubCommand(ctx.bin, 'codex', 'echo not-json');

  const result = await ctx.doctor();

  expect(result.stdout).toContain(
    'www doctor: codex execpolicy check printed no decision that doctor can read for www.\n',
  );
});

test('it fails a check when codex is not on the PATH, and says the Codex rule is not checked', async () => {
  const ctx = await setupTest();

  rmSync(join(ctx.bin, 'codex'));

  const result = await ctx.doctor();

  expect(result.exitCode).toBe(3);

  expect(result.stdout).toContain(
    'www doctor: codex is not on PATH, so the Codex rule is not checked.\n',
  );
});

test('it never runs a codex that a folder under the working folder holds', async () => {
  const ctx = await setupTest();

  const planted = join(ctx.work, 'bin');
  const marker = join(ctx.root, 'ran');

  rmSync(join(ctx.bin, 'codex'));
  seedStubCommand(planted, 'codex', `echo ran > ${marker}\necho '{"decision":"allow"}'`);

  const result = await ctx.doctor({ PATH: ['bin', planted, ctx.bin].join(':') });

  expect(result.stdout).toContain('www doctor: codex is not on PATH');
  expect(existsSync(marker)).toBe(false);
});

test('it never runs a gh that a relative PATH entry holds', async () => {
  const ctx = await setupTest();

  const marker = join(ctx.root, 'ran');

  rmSync(join(ctx.bin, 'gh'));
  seedStubCommand(join(ctx.work, 'bin'), 'gh', `echo ran > ${marker}`);

  const result = await ctx.doctor({ PATH: ['bin', ctx.bin].join(':') });

  expect(result.stdout).toContain(
    'www doctor: gh is not on PATH, so no check reads a pull request.\n',
  );

  expect(existsSync(marker)).toBe(false);
});

test.each([
  { folder: '.claude', file: 'settings.json', shown: '.claude/settings.json' },
  { folder: '.claude', file: 'settings.local.json', shown: '.claude/settings.local.json' },
])('it reports a deny rule for www in the project file $shown', async (row) => {
  const ctx = await setupTest();

  ctx.place(join(ctx.work, row.folder, row.file), '{"permissions":{"deny":["Bash(www *)"]}}');

  const result = await ctx.doctor();

  expect(result.stdout).toContain(
    `www doctor: rule 1 of permissions.deny in ${row.shown} matches www, so Claude Code does not run it without asking.\n`,
  );
});

test('it reports hooks turned off and a store root that only a comment names', async () => {
  const ctx = await setupTest();

  ctx.place(
    ctx.paths.codexConfig,
    `[features] # toggles\nhooks = false\n\n[sandbox_workspace_write]\nwritable_roots = [] # "${ctx.storeRoot}"\n`,
  );

  const result = await ctx.doctor();

  expect(result.stdout).toContain(
    `www doctor: ~/.codex/config.toml turns hooks off with hooks = false.\nSet hooks = true under [features] in ~/.codex/config.toml.\nwww doctor: ~/.codex/config.toml does not list ${ctx.storeRoot} in writable_roots, so a Codex write to the store fails in the sandbox.\nRun: www install --print\n`,
  );
});

test('it reports a config.toml that is not TOML', async () => {
  const ctx = await setupTest();

  ctx.place(ctx.paths.codexConfig, 'hooks = [');

  const result = await ctx.doctor();

  expect(result.stdout).toContain(
    'www doctor: ~/.codex/config.toml is not TOML that doctor can read.\nRun: www install --print\n',
  );
});

test.each([
  {
    title: 'hooks turned off',
    text: '[features]\nhooks = false\n\n[sandbox_workspace_write]\nwritable_roots = ["ROOT"]\n',
    expected:
      'turns hooks off with hooks = false.\nSet hooks = true under [features] in ~/.codex/config.toml.\n',
  },
  {
    title: 'no writable root',
    text: '[features]\nhooks = true\n',
    expected:
      'does not list ROOT in writable_roots, so a Codex write to the store fails in the sandbox.\nRun: www install --print\n',
  },
])('it reports a config.toml with $title', async (row) => {
  const ctx = await setupTest();

  ctx.place(ctx.paths.codexConfig, row.text.replaceAll('ROOT', ctx.storeRoot));

  const result = await ctx.doctor();

  expect(result.exitCode).toBe(3);

  expect(result.stdout).toContain(
    `www doctor: ~/.codex/config.toml ${row.expected.replaceAll('ROOT', ctx.storeRoot)}`,
  );
});

test('it passes a config.toml with no hooks line, since hooks are on by default', async () => {
  const ctx = await setupTest();

  ctx.place(
    ctx.paths.codexConfig,
    `[sandbox_workspace_write]\nwritable_roots = ["${ctx.storeRoot}"]\n`,
  );

  const result = await ctx.doctor();

  expect(result.exitCode).toBe(0);
});

test('it reports a store root that this shell cannot write', async () => {
  const ctx = await setupTest();

  writeFileSync(join(ctx.root, 'state'), 'a file where the folder goes');

  const result = await ctx.doctor();

  expect(result.stdout).toContain(
    `www doctor: this shell cannot write the store root ${ctx.storeRoot}.\nRun: mkdir -p ${ctx.storeRoot}\n`,
  );
});

test('it reports a gh that is not signed in, without printing what gh says', async () => {
  const ctx = await setupTest();

  seedStubCommand(ctx.bin, 'gh', 'echo "token ghx_leak" >&2\nexit 1');

  const result = await ctx.doctor();

  expect(result.stdout).toContain('www doctor: gh is not signed in.\nRun: gh auth login\n');
  expect(result.stdout).not.toContain('leak');
});

test.each([
  {
    title: 'a project settings file of Claude Code',
    relative: ['.claude', 'settings.json'],
    shown: '.claude/settings.json',
    harness: 'claude',
  },
  {
    title: 'a project local settings file of Claude Code',
    relative: ['.claude', 'settings.local.json'],
    shown: '.claude/settings.local.json',
    harness: 'claude',
  },
  {
    title: 'a project hooks file of Codex',
    relative: ['.codex', 'hooks.json'],
    shown: '.codex/hooks.json',
    harness: 'codex',
  },
])(
  'it fails the check of one entry per event for a second wherewerewe hook in $title',
  async (row) => {
    const ctx = await setupTest();

    const second = {
      hooks: {
        Stop: [{ hooks: [{ type: 'command', command: `/other/wherewerewe hook ${row.harness}` }] }],
      },
    };

    ctx.place(join(ctx.work, ...row.relative), JSON.stringify(second));

    const result = await ctx.doctor();

    expect(result.exitCode).toBe(3);

    expect(result.stdout).toContain(
      `www doctor: Stop runs wherewerewe hook ${row.harness} 2 times: `,
    );

    expect(result.stdout).toContain(row.shown);
  },
);

test('it fails the check of one entry per event for a second wherewerewe hook in the user file of Claude Code', async () => {
  const ctx = await setupTest();

  ctx.edit(ctx.paths.claudeSettings, (text) => {
    const settings = parseSettingsJson(text);

    settings.hooks.Stop?.push({
      hooks: [{ type: 'command', command: '/other/wherewerewe hook claude' }],
    });

    return JSON.stringify(settings);
  });

  const result = await ctx.doctor();

  expect(result.stdout).toContain(
    'www doctor: Stop runs wherewerewe hook claude 2 times: ~/.claude/settings.json, ~/.claude/settings.json.\n',
  );
});

test('it fails the check of one entry per event for a Codex hook in a config.toml table', async () => {
  const ctx = await setupTest();

  ctx.place(
    join(ctx.work, '.codex', 'config.toml'),
    '[[hooks.Stop]]\n[[hooks.Stop.hooks]]\ntype = "command"\ncommand = "/other/wherewerewe hook codex"\n',
  );

  const result = await ctx.doctor();

  expect(result.stdout).toContain(
    'www doctor: Stop runs wherewerewe hook codex 2 times: ~/.codex/hooks.json, .codex/config.toml.\n',
  );
});

test('it counts a Codex hook whose command a config.toml writes as a single-quoted string', async () => {
  const ctx = await setupTest();

  ctx.place(
    join(ctx.work, '.codex', 'config.toml'),
    "[[hooks.Stop]]\n[[hooks.Stop.hooks]]\ntype = 'command'\ncommand = '/other/wherewerewe hook codex'\n",
  );

  const result = await ctx.doctor();

  expect(result.stdout).toContain(
    'www doctor: Stop runs wherewerewe hook codex 2 times: ~/.codex/hooks.json, .codex/config.toml.\n',
  );
});

test.each([
  { title: 'missing', text: null, fix: 'Run: www install' },
  { title: 'written by an older version', text: renderSkill('0.0.0'), fix: 'Run: www install' },
  {
    title: 'edited since',
    text: `${renderSkill('0.0.1')}\nMore.\n`,
    fix: 'Run: www install --replace-skill',
  },
  {
    title: 'a hand-written stopgap',
    text: '---\nname: www\ndescription: "x"\n---\n\n# www\n',
    fix: 'Run: www install --replace-skill',
  },
])('it reports a skill that is $title', async (row) => {
  const ctx = await setupTest();

  if (row.text === null) {
    rmSync(ctx.paths.claudeSkill);
  } else {
    ctx.place(ctx.paths.claudeSkill, row.text);
  }

  const result = await ctx.doctor();

  expect(result.stdout).toContain(
    `www doctor: ~/.claude/skills/www/SKILL.md is not the www skill of this binary.\n${row.fix}\n`,
  );
});

test('it names the hook entries of Claude Code as missing after a user removes them', async () => {
  const ctx = await setupTest();

  ctx.edit(ctx.paths.claudeSettings, () => '{}');

  const result = await ctx.doctor();

  expect(result.stdout).toContain('www doctor: ~/.claude/settings.json has no SessionStart entry');
});

test('it names the hook entries of Codex as missing after a user removes them', async () => {
  const ctx = await setupTest();

  ctx.edit(ctx.paths.codexHooks, () => '{}');

  const result = await ctx.doctor();

  expect(result.stdout).toContain('www doctor: ~/.codex/hooks.json has no SessionStart entry');
});

test('it names the rules file as missing after a user removes it', async () => {
  const ctx = await setupTest();

  rmSync(dirname(ctx.paths.codexRules), { recursive: true });

  const result = await ctx.doctor();

  expect(result.stdout).toContain('www doctor: ~/.codex/rules/wherewerewe.rules does not exist');
});

test('it names the Claude Code skill as missing after a user removes its folder', async () => {
  const ctx = await setupTest();

  rmSync(dirname(ctx.paths.claudeSkill), { recursive: true });

  const result = await ctx.doctor();

  expect(result.stdout).toContain(
    'www doctor: ~/.claude/skills/www/SKILL.md is not the www skill of this binary.',
  );
});

test('it names the Codex skill as missing after a user removes its folder', async () => {
  const ctx = await setupTest();

  rmSync(dirname(ctx.paths.codexSkill), { recursive: true });

  const result = await ctx.doctor();

  expect(result.stdout).toContain(
    'www doctor: ~/.agents/skills/www/SKILL.md is not the www skill of this binary.',
  );
});

test('it names the allow rule as missing after a user removes it', async () => {
  const ctx = await setupTest();

  ctx.edit(ctx.paths.claudeSettings, (text) => {
    const settings = parseSettingsJson(text);

    settings.permissions = {};

    return JSON.stringify(settings);
  });

  const result = await ctx.doctor();

  expect(result.stdout).toContain('www doctor: no allow rule for www in ~/.claude/settings.json');
});

test('it prints no value of a settings file beyond the lines it names', async () => {
  const ctx = await setupTest();

  const secret = buildCredentialSamples()[0]?.sample ?? '';

  ctx.edit(ctx.paths.claudeSettings, (text) => {
    const settings = parseSettingsJson(text);

    settings.env = { API_TOKEN: secret };
    settings.permissions.ask = [`Bash(curl -H "Authorization: ${secret}" *)`];

    return JSON.stringify(settings);
  });

  const result = await ctx.doctor();

  expect(`${result.stdout}${result.stderr}`).not.toContain(secret.slice(0, 12));
});
