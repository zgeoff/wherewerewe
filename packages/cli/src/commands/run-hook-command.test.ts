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
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { briefFooter } from '../brief/join-brief.ts';
import { parseGateFile } from '../hooks/parse-gate-file.ts';
import type { Harness } from '../hooks/types.ts';
import { buildHookContext } from '../test-utils/build-hook-context.ts';
import { buildHookPayload } from '../test-utils/build-hook-payload.ts';
import type { HookPayloadSpec } from '../test-utils/build-hook-payload.ts';
import { readGateLine } from '../test-utils/read-gate-line.ts';
import { seedHookStore } from '../test-utils/seed-hook-store.ts';
import { toHookDecision } from '../test-utils/to-hook-decision.ts';
import { runHookCommand } from './run-hook-command.ts';

async function setupTest(harness: Harness) {
  const root = createTempDir('run-hook-command').path;
  const sessionID = '9e1f-trial';
  const context = buildHookContext(root);

  await seedHookStore(root, { harness, id: sessionID }, 'tide-alerts');

  const run = (spec: HookPayloadSpec) =>
    runHookCommand(harness, buildHookPayload(harness, sessionID, spec), context);

  const whole = `tide-alerts · day 1 · Tue 2026-03-10 11:43Z · no checks\nGOAL  Ship it\n${briefFooter}\n`;

  const steps = {
    start: { event: 'SessionStart' } satisfies HookPayloadSpec,
    brief: { event: 'PreToolUse', command: 'www' } satisfies HookPayloadSpec,
    ls: { event: 'PreToolUse', command: 'ls' } satisfies HookPayloadSpec,
    cat: { event: 'PreToolUse', command: 'cat notes.txt' } satisfies HookPayloadSpec,
    www: { event: 'PreToolUse', command: 'www import tide-alerts' } satisfies HookPayloadSpec,
    stop: { event: 'Stop' } satisfies HookPayloadSpec,
    whole: { event: 'PostToolUse', command: 'www', output: whole } satisfies HookPayloadSpec,
    cut: {
      event: 'PostToolUse',
      command: 'www',
      output: whole.replace('GOAL', '…3000 tokens truncated…\nGOAL'),
    } satisfies HookPayloadSpec,
    failed: {
      event: 'PostToolUse',
      command: 'www',
      output: 'www: command not found',
    } satisfies HookPayloadSpec,
  };

  return {
    root,
    sessionID,
    run,
    steps,
    gate: () => readGateLine(root, `${harness}-${sessionID}`),
    play: async (specs: readonly HookPayloadSpec[]) => {
      const seen: string[] = [];

      for (const spec of specs) {
        const result = await run(spec);

        const file = parseGateFile(readGateLine(root, `${harness}-${sessionID}`) ?? '');

        seen.push(
          `${toHookDecision(result.stdout)}:${file?.state ?? 'none'} reads=${String(file?.reads ?? 0)} spare=${String(file?.spare ?? 0)}`,
        );
      }

      return seen;
    },
  };
}

test.each(['claude', 'codex'] as const)(
  'it prints nothing and writes nothing for an unbound id on %s',
  async (harness) => {
    const ctx = await setupTest(harness);

    const other = buildHookPayload(harness, 'ffff-unbound', { event: 'SessionStart' });

    const results = await Promise.all(
      [
        other,
        buildHookPayload(harness, 'ffff-unbound', { event: 'PreToolUse', command: 'ls' }),
        buildHookPayload(harness, 'ffff-unbound', { event: 'Stop' }),
        buildHookPayload(harness, 'ffff-unbound', { event: 'SubagentStart' }),
        buildHookPayload(harness, 'ffff-unbound', {
          event: 'PostToolUse',
          command: 'ls',
          output: 'a',
        }),
      ].map((text) => runHookCommand(harness, text, buildHookContext(ctx.root))),
    );

    expect({
      outputs: results.map((result) => result.stdout),
      gates: existsSync(join(ctx.root, '.gate')),
      log: existsSync(join(ctx.root, 'hook-errors.log')),
    }).toStrictEqual({ outputs: ['', '', '', '', ''], gates: false, log: false });
  },
);

test.each(['claude', 'codex'] as const)(
  'it wipes the gate and injects the goal, the grant and the two lines on %s',
  async (harness) => {
    const ctx = await setupTest(harness);
    const result = await ctx.run(ctx.steps.start);

    const run =
      harness === 'codex'
        ? 'Run: www   (pass max_output_tokens 10000, so the whole brief reaches you)'
        : 'Run: www';

    expect({ result, gate: ctx.gate() }).toStrictEqual({
      result: {
        stdout: `GOAL  Ship the parser with its tests\nGRANT  none. Run: www grant --may "<what the owner allows, in their words>" --where <where> --reading "<what they cover; what the owner kept back>"\nwherewerewe: this session started or was compacted, and tide-alerts's brief is not in your context yet.\n${run}\n`,
        stderr: '',
        exitCode: 0,
      },
      gate: 'state=wiped session=tide-alerts reads=0 spare=1',
    });
  },
);

test.each([
  {
    title: 'a batched call whose PreToolUse runs before the read ends',
    steps: ['start', 'brief', 'ls', 'whole', 'ls'],
    seen: [
      'inject:wiped reads=0 spare=1',
      'pass:reading reads=1 spare=1',
      'refuse:reading reads=1 spare=1',
      'pass:read reads=0 spare=1',
      'pass:read reads=0 spare=1',
    ],
    harnesses: ['claude', 'codex'],
  },
  {
    title: 'the same call when its PreToolUse runs after the read ends',
    steps: ['start', 'brief', 'whole', 'ls'],
    seen: [
      'inject:wiped reads=0 spare=1',
      'pass:reading reads=1 spare=1',
      'pass:read reads=0 spare=1',
      'pass:read reads=0 spare=1',
    ],
    harnesses: ['claude', 'codex'],
  },
  {
    title: 'two batched calls, then a cut read',
    steps: ['start', 'brief', 'ls', 'cat', 'cut', 'ls', 'cat'],
    seen: [
      'inject:wiped reads=0 spare=1',
      'pass:reading reads=1 spare=1',
      'refuse:reading reads=1 spare=1',
      'refuse:reading reads=1 spare=1',
      'pass:cut reads=0 spare=1',
      'refuse-cut:cut reads=0 spare=0',
      'pass+line:open reads=0 spare=0',
    ],
    harnesses: ['codex'],
  },
  {
    title: 'a retry that fails',
    steps: ['start', 'brief', 'cut', 'ls', 'brief', 'failed', 'ls'],
    seen: [
      'inject:wiped reads=0 spare=1',
      'pass:reading reads=1 spare=1',
      'pass:cut reads=0 spare=1',
      'refuse-cut:cut reads=0 spare=0',
      'pass:reading reads=1 spare=0',
      'pass:failed reads=0 spare=0',
      'pass+line:open reads=0 spare=0',
    ],
    harnesses: ['codex'],
  },
  {
    title: 'a slow www',
    steps: ['start', 'brief', 'ls', 'ls', 'whole'],
    seen: [
      'inject:wiped reads=0 spare=1',
      'pass:reading reads=1 spare=1',
      'refuse:reading reads=1 spare=1',
      'refuse:reading reads=1 spare=1',
      'pass:read reads=0 spare=1',
    ],
    harnesses: ['claude', 'codex'],
  },
  {
    title: 'a www refused at the permission step',
    steps: ['start', 'brief', 'ls', 'stop', 'ls'],
    seen: [
      'inject:wiped reads=0 spare=1',
      'pass:reading reads=1 spare=1',
      'refuse:reading reads=1 spare=1',
      'pass:failed reads=0 spare=1',
      'pass+line:open reads=0 spare=1',
    ],
    harnesses: ['claude', 'codex'],
  },
  {
    title: 'exit 5',
    steps: ['start', 'brief', 'failed', 'ls', 'www'],
    seen: [
      'inject:wiped reads=0 spare=1',
      'pass:reading reads=1 spare=1',
      'pass:failed reads=0 spare=1',
      'pass+line:open reads=0 spare=1',
      'pass:open reads=0 spare=1',
    ],
    harnesses: ['claude', 'codex'],
  },
  {
    title: 'a Stop in wiped that blocks once, then passes and opens the gate',
    steps: ['start', 'stop', 'stopActive', 'ls'],
    seen: [
      'inject:wiped reads=0 spare=1',
      'block:wiped reads=0 spare=1',
      'pass:failed reads=0 spare=1',
      'pass+line:open reads=0 spare=1',
    ],
    harnesses: ['claude', 'codex'],
  },
  {
    title: 'two brief commands in flight, one fails, and the second is cut',
    steps: ['start', 'brief', 'brief', 'failed', 'ls', 'cut', 'ls', 'ls'],
    seen: [
      'inject:wiped reads=0 spare=1',
      'pass:reading reads=1 spare=1',
      'pass:reading reads=2 spare=1',
      'pass:reading reads=1 spare=1',
      'refuse:reading reads=1 spare=1',
      'pass:cut reads=0 spare=1',
      'refuse-cut:cut reads=0 spare=0',
      'pass+line:open reads=0 spare=0',
    ],
    harnesses: ['codex'],
  },
] as const)('it follows the ordering $title', async (row) => {
  const results = await Promise.all(
    row.harnesses.map(async (harness) => {
      const ctx = await setupTest(harness);

      const specs = row.steps.map((name) =>
        name === 'stopActive'
          ? ({ event: 'Stop', stopHookActive: true } satisfies HookPayloadSpec)
          : ctx.steps[name],
      );

      return ctx.play(specs);
    }),
  );

  expect(results).toStrictEqual(row.harnesses.map(() => [...row.seen]));
});

test.each(['claude', 'codex'] as const)(
  'it follows a brief command that runs across a compaction on %s',
  async (harness) => {
    const ctx = await setupTest(harness);

    const seen = await ctx.play([
      ctx.steps.start,
      ctx.steps.brief,
      ctx.steps.start,
      ctx.steps.brief,
      ctx.steps.failed,
      ctx.steps.ls,
      ctx.steps.whole,
    ]);

    expect(seen).toStrictEqual([
      'inject:wiped reads=0 spare=1',
      'pass:reading reads=1 spare=1',
      'inject:wiped reads=1 spare=1',
      'pass:reading reads=2 spare=1',
      'pass:reading reads=1 spare=1',
      'refuse:reading reads=1 spare=1',
      'pass:read reads=0 spare=1',
    ]);
  },
);

test.each(['claude', 'codex'] as const)(
  'it applies the PreToolUse of two brief commands run together one after the other on %s',
  async (harness) => {
    const ctx = await setupTest(harness);

    await ctx.run(ctx.steps.start);
    await Promise.all([ctx.run(ctx.steps.brief), ctx.run(ctx.steps.brief)]);

    const afterBoth = ctx.gate();

    await ctx.run(ctx.steps.failed);

    expect({ afterBoth, afterFailed: ctx.gate() }).toStrictEqual({
      afterBoth: 'state=reading session=tide-alerts reads=2 spare=1',
      afterFailed: 'state=reading session=tide-alerts reads=1 spare=1',
    });
  },
);

test.each(['claude', 'codex'] as const)(
  'it passes every payload of a subagent and writes nothing on %s',
  async (harness) => {
    const ctx = await setupTest(harness);

    await ctx.run(ctx.steps.start);

    const before = ctx.gate();

    const results = await Promise.all([
      ctx.run({ event: 'PreToolUse', command: 'ls', agentID: 'sub-1' }),
      ctx.run({ event: 'Stop', agentID: 'sub-1' }),
      ctx.run({
        event: 'PostToolUse',
        command: 'www',
        output: ctx.steps.whole.output,
        agentID: 'sub-1',
      }),
    ]);

    expect({
      outputs: results.map((result) => result.stdout),
      unchanged: ctx.gate() === before,
    }).toStrictEqual({
      outputs: ['', '', ''],
      unchanged: true,
    });
  },
);

test.each(['claude', 'codex'] as const)(
  'it passes a bound id with no gate file and prints nothing for it on %s',
  async (harness) => {
    const ctx = await setupTest(harness);
    const results = await Promise.all([ctx.run(ctx.steps.ls), ctx.run(ctx.steps.stop)]);

    expect({
      outputs: results.map((result) => result.stdout),
      gates: existsSync(join(ctx.root, '.gate')),
    }).toStrictEqual({
      outputs: ['', ''],
      gates: false,
    });
  },
);

test('it prints the SubagentStart line for a bound session on Claude Code', async () => {
  const ctx = await setupTest('claude');
  const result = await ctx.run({ event: 'SubagentStart' });

  expect(JSON.parse(result.stdout)).toStrictEqual({
    hookSpecificOutput: {
      hookEventName: 'SubagentStart',
      additionalContext:
        'This session keeps its notes in wherewerewe session tide-alerts. When a www command says there is no session, add --session tide-alerts.',
    },
  });
});

test('it reads a file that does not parse as a hook error and passes the call', async () => {
  const ctx = await setupTest('claude');

  await ctx.run(ctx.steps.start);

  writeFileSync(join(ctx.root, '.gate', `claude-${ctx.sessionID}`), 'garbage\n');

  const result = await ctx.run(ctx.steps.ls);

  expect({
    stdout: result.stdout,
    log: readFileSync(join(ctx.root, 'hook-errors.log'), 'utf8').includes('does not parse'),
  }).toStrictEqual({ stdout: '', log: true });
});

test('it replaces a gate file that does not parse at the next SessionStart', async () => {
  const ctx = await setupTest('claude');

  await ctx.run(ctx.steps.start);

  writeFileSync(join(ctx.root, '.gate', `claude-${ctx.sessionID}`), 'garbage\n');

  await ctx.run(ctx.steps.start);

  expect(ctx.gate()).toBe('state=wiped session=tide-alerts reads=0 spare=1');
});

test('it reads a gate file of another session as wiped after an attach', async () => {
  const ctx = await setupTest('claude');

  await ctx.run(ctx.steps.start);
  await ctx.run(ctx.steps.brief);
  await ctx.run(ctx.steps.whole);

  await seedHookStore(ctx.root, { harness: 'claude', id: ctx.sessionID }, 'docs-move');

  const result = await ctx.run(ctx.steps.ls);

  expect({ decision: toHookDecision(result.stdout), gate: ctx.gate() }).toStrictEqual({
    decision: 'refuse',
    gate: 'state=wiped session=docs-move reads=0 spare=1',
  });
});

test('it makes a late end across a wipe count against the new state', async () => {
  const ctx = await setupTest('claude');

  await ctx.run(ctx.steps.start);
  await ctx.run(ctx.steps.brief);
  await ctx.run(ctx.steps.start);
  await ctx.run(ctx.steps.whole);

  expect(ctx.gate()).toBe('state=read session=tide-alerts reads=0 spare=1');
});

test('it prints nothing and logs when the store of a bound id is missing, and wipes the gate', async () => {
  const ctx = await setupTest('claude');

  writeFileSync(join(ctx.root, '.bindings', `claude-${ctx.sessionID}`), 'name=gone-away\n');

  const result = await ctx.run(ctx.steps.start);

  expect({
    stdout: result.stdout,
    gate: ctx.gate(),
    log: readFileSync(join(ctx.root, 'hook-errors.log'), 'utf8').includes('cannot be read'),
  }).toStrictEqual({
    stdout: '',
    gate: 'state=wiped session=gone-away reads=0 spare=1',
    log: true,
  });
});

test('it writes no debug line without a hook-debug file, and one per event with it', async () => {
  const ctx = await setupTest('claude');

  await ctx.run(ctx.steps.start);
  await ctx.run(ctx.steps.brief);

  const without = existsSync(join(ctx.root, 'hook-errors.log'));

  writeFileSync(join(ctx.root, 'hook-debug'), '');

  await ctx.run(ctx.steps.whole);

  const lines = readFileSync(join(ctx.root, 'hook-errors.log'), 'utf8').trim().split('\n');

  expect({
    without,
    lines: lines.length,
    line: lines[0]?.includes('debug session=9e1f-trial'),
  }).toStrictEqual({
    without: false,
    lines: 1,
    line: true,
  });
});

test.each(['claude', 'codex'] as const)(
  'it writes one debug line, labelled with its event, for each kind of event on %s',
  async (harness) => {
    const ctx = await setupTest(harness);

    const failure = { event: 'PostToolUseFailure', command: 'www' } satisfies HookPayloadSpec;

    writeFileSync(join(ctx.root, 'hook-debug'), '');

    const specs = [
      ctx.steps.start,
      { event: 'SubagentStart' },
      ctx.steps.brief,
      ctx.steps.whole,
      ctx.steps.ls,
      ctx.steps.stop,
      ...(harness === 'claude' ? [failure] : [ctx.steps.failed]),
    ] satisfies HookPayloadSpec[];

    for (const spec of specs) {
      await ctx.run(spec);
    }

    const labels = readFileSync(join(ctx.root, 'hook-errors.log'), 'utf8')
      .trim()
      .split('\n')
      .map((line) => line.split(' ').slice(1, 3).join(' '));

    expect(labels).toStrictEqual([
      `${harness} SessionStart`,
      `${harness} SubagentStart`,
      `${harness} PreToolUse`,
      `${harness} PostToolUse`,
      `${harness} PreToolUse`,
      `${harness} Stop`,
      harness === 'claude' ? 'claude PostToolUseFailure' : 'codex PostToolUse',
    ]);
  },
);

test('it writes a debug line for an unbound id and for a post-tool event that is no end', async () => {
  const ctx = await setupTest('claude');

  writeFileSync(join(ctx.root, 'hook-debug'), '');
  rmSync(join(ctx.root, '.bindings', `claude-${ctx.sessionID}`));

  await ctx.run(ctx.steps.ls);
  await ctx.run({ event: 'PostToolUse', command: 'ls', output: 'a.txt' });

  const lines = readFileSync(join(ctx.root, 'hook-errors.log'), 'utf8').trim().split('\n');

  expect(
    lines.map((line) => line.split(' ').slice(2).join(' ').split(' output=')[0]),
  ).toStrictEqual([
    'PreToolUse debug session=9e1f-trial agent=- sorted=unbound',
    'PostToolUse debug session=9e1f-trial agent=- sorted=unbound',
  ]);
});

test('it still wipes the gate at SessionStart when the session file cannot be read', async () => {
  const ctx = await setupTest('claude');

  await ctx.run(ctx.steps.start);
  await ctx.run(ctx.steps.brief);
  await ctx.run(ctx.steps.whole);

  const session = join(ctx.root, 'tide-alerts', 'session');

  chmodSync(session, 0o000);

  const result = await ctx.run(ctx.steps.start);

  chmodSync(session, 0o600);

  expect({ stdout: result.stdout, exitCode: result.exitCode, gate: ctx.gate() }).toStrictEqual({
    stdout: '',
    exitCode: 0,
    gate: 'state=wiped session=tide-alerts reads=0 spare=1',
  });
});

test.each(['claude', 'codex'] as const)(
  'it runs as it would with no fault when the hook-fault file cannot be read, on %s',
  async (harness) => {
    const ctx = await setupTest(harness);

    mkdirSync(join(ctx.root, 'hook-fault'));

    const result = await ctx.run(ctx.steps.start);

    expect({
      exitCode: result.exitCode,
      stderr: result.stderr,
      hasInjection: result.stdout !== '',
    }).toStrictEqual({
      exitCode: 0,
      stderr: '',
      hasInjection: true,
    });
  },
);

test('it never writes the text of an output into a debug line', async () => {
  const ctx = await setupTest('claude');

  await ctx.run(ctx.steps.start);
  await ctx.run(ctx.steps.brief);

  writeFileSync(join(ctx.root, 'hook-debug'), '');

  await ctx.run(ctx.steps.whole);

  expect(readFileSync(join(ctx.root, 'hook-errors.log'), 'utf8')).not.toContain('Ship it');
});

test.each([
  { fault: 'exit', stdout: '', exitCode: 1 },
  { fault: 'garbage', stdout: '{', exitCode: 0 },
  { fault: 'sleep', stdout: '', exitCode: 0 },
] as const)('it fails on purpose with the fault $fault, on both harnesses', async (row) => {
  const results = await Promise.all(
    (['claude', 'codex'] as const).map(async (harness) => {
      const ctx = await setupTest(harness);

      writeFileSync(join(ctx.root, 'hook-fault'), row.fault);

      return ctx.run(ctx.steps.start);
    }),
  );

  expect(
    results.map((result) => ({ stdout: result.stdout, exitCode: result.exitCode })),
  ).toStrictEqual([
    { stdout: row.stdout, exitCode: row.exitCode },
    { stdout: row.stdout, exitCode: row.exitCode },
  ]);
});

test('it behaves the same with no fault file as without the switch', async () => {
  const ctx = await setupTest('claude');
  const result = await ctx.run(ctx.steps.start);

  expect({ exitCode: result.exitCode, files: readdirSync(ctx.root).toSorted() }).toStrictEqual({
    exitCode: 0,
    files: ['.bindings', '.gate', 'tide-alerts'],
  });
});

test('it ends the log at 200 lines', async () => {
  const ctx = await setupTest('claude');

  writeFileSync(join(ctx.root, 'hook-errors.log'), 'old line\n'.repeat(250));
  writeFileSync(join(ctx.root, '.bindings', `claude-${ctx.sessionID}`), 'name=gone-away\n');

  await ctx.run(ctx.steps.start);

  expect(readFileSync(join(ctx.root, 'hook-errors.log'), 'utf8').trim().split('\n')).toHaveLength(
    200,
  );
});

test.each(['claude', 'codex'] as const)(
  'it holds no classifier key in any output on %s',
  async (harness) => {
    const ctx = await setupTest(harness);
    const started = await ctx.run(ctx.steps.start);
    const refused = await ctx.run(ctx.steps.ls);
    const stopped = await ctx.run(ctx.steps.stop);
    const subagent = await ctx.run({ event: 'SubagentStart' });

    const outputs = [started, refused, stopped, subagent].map((result) => result.stdout).join('\n');

    expect(
      ['classifierContext', 'onFailure', 'additionalContextLimit', 'bashOutputMaxChars'].filter(
        (key) => outputs.includes(key),
      ),
    ).toStrictEqual([]);
  },
);
