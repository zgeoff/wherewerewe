import { match } from 'ts-pattern';
import { helpText } from './args/help-text.ts';
import { parseArgs } from './args/parse-args.ts';
import { runAdd } from './commands/run-add.ts';
import { runAttach } from './commands/run-attach.ts';
import { runBrief } from './commands/run-brief.ts';
import { runClose } from './commands/run-close.ts';
import { runDetach } from './commands/run-detach.ts';
import { runInit } from './commands/run-init.ts';
import { runRows } from './commands/run-rows.ts';
import { runSessions } from './commands/run-sessions.ts';
import { runSet } from './commands/run-set.ts';
import { runHook } from './hook/run-hook.ts';
import { runDoctor } from './install/run-doctor.ts';
import { runInstall } from './install/run-install.ts';
import { RefusalError } from './refusal-error.ts';
import type { Args, Context, Reply, Result } from './types.ts';

// Runs one command. A refusal prints its reason and the command that puts it right.
export async function runCLI(context: Context): Promise<Result> {
  try {
    const args = parseArgs(context.argv);

    return await dispatch(context, args);
  } catch (error) {
    if (error instanceof RefusalError) {
      const isHuman = context.argv.includes('--human') || context.argv.length === 0;

      const text = isHuman
        ? `www: ${error.message}\nRun: ${error.run}`
        : JSON.stringify({ ok: false, error: error.message, run: error.run });

      return { stdout: '', stderr: `${text}\n`, exitCode: error.exitCode };
    }

    throw error;
  }
}

async function dispatch(context: Context, args: Args): Promise<Result> {
  const [command, ...words] = args.words;
  const rest: Args = { ...args, words };

  if (args.switches.has('version')) {
    return { stdout: `wherewerewe ${context.version}\n`, stderr: '', exitCode: 0 };
  }

  if (command === 'help' || args.switches.has('help')) {
    return { stdout: helpText, stderr: '', exitCode: 0 };
  }

  const result = await match(command)
    .with(undefined, async () => {
      const stdout = await runBrief(context, rest);

      return { stdout, stderr: '', exitCode: 0 };
    })
    .with('rows', async () => {
      const reply = await runRows(context, rest);

      return buildResult(reply, args);
    })
    .with('add', async () => {
      const [label, ...text] = words;

      const reply = await runAdd(context, { ...args, words: text }, label ?? '');

      return buildResult(reply, args);
    })
    .with('set', async () => {
      const reply = await runSet(context, rest);

      return buildResult(reply, args);
    })
    .with('done', async () => {
      const reply = await runClose(context, rest, 'done');

      return buildResult(reply, args);
    })
    .with('drop', async () => {
      const reply = await runClose(context, rest, 'dropped');

      return buildResult(reply, args);
    })
    .with('init', async () => {
      const reply = await runInit(context, rest);

      return buildResult(reply, args);
    })
    .with('attach', async () => {
      const reply = await runAttach(context, rest);

      return buildResult(reply, args);
    })
    .with('detach', async () => {
      const reply = await runDetach(context);

      return buildResult(reply, args);
    })
    .with('sessions', async () => {
      const reply = await runSessions(context);

      return buildResult(reply, args);
    })
    .with('install', async () => {
      const reply = await runInstall(context, args.switches.has('print'));

      return buildResult(reply, args);
    })
    .with('doctor', async () => {
      const outcome = await runDoctor(context);

      return buildResult(outcome.reply, args, outcome.exitCode);
    })
    .with('hook', async () => {
      const harness = words[0] === 'codex' ? 'codex' : 'claude';

      const stdout = await runHook(context, harness);

      return { stdout, stderr: '', exitCode: 0 };
    })
    .with('list', 'show', 'log', 'recap', 'say', 'ack', 'ok', 'use', 'import', (gone) => {
      // version 0.1 had these commands, and an agent with the old habit must not write a junk row
      throw new RefusalError(
        `${gone} left in version 0.2: every note is a row now`,
        'www rows | jq   or   www help',
      );
    })
    .otherwise(async (label) => {
      // any other first word is a label: www task "…", www rule "…", www note "…"
      const reply = await runAdd(context, rest, label);

      return buildResult(reply, args);
    });

  return result;
}

function buildResult(reply: Reply, args: Args, exitCode = 0): Result {
  const json = Array.isArray(reply.json)
    ? reply.json.map((value: unknown) => JSON.stringify(value)).join('\n')
    : JSON.stringify(reply.json);

  const text = args.switches.has('human') ? reply.human : json;

  return { stdout: text === '' ? '' : `${text}\n`, stderr: '', exitCode };
}
