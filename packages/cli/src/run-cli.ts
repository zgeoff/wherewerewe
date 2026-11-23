import { join } from 'node:path';
import { match } from 'ts-pattern';
import { helpText } from './args/help-text.ts';
import { parseCLIArgs } from './args/parse-cli-args.ts';
import { getSessionDay } from './brief/get-session-day.ts';
import { formatSessionLines } from './commands/format-session-lines.ts';
import { runBriefCommand } from './commands/run-brief-command.ts';
import { runSessionCommand } from './commands/run-session-command.ts';
import type { CommandContext } from './commands/types.ts';
import { buildReadRefusal } from './refusals/build-read-refusal.ts';
import { buildRefusal } from './refusals/build-refusal.ts';
import { formatRefusal } from './refusals/format-refusal.ts';
import type { RefusalScope } from './refusals/format-refusal.ts';
import { readRefusalScope } from './refusals/read-refusal-scope.ts';
import { isSessionName } from './rules/is-session-name.ts';
import { readSessionSummaries } from './sessions/read-session-summaries.ts';
import { resolveSession } from './sessions/resolve-session.ts';
import { findStoreRoot } from './store/find-store-root.ts';
import { readStore } from './store/read-store.ts';
import type { CLIInput, CLIResult, ParsedArgs, Refusal, Store } from './types.ts';
import { pickClose } from './writes/pick-close.ts';
import { pickGoalWrite } from './writes/pick-goal-write.ts';
import { pickItemWrite } from './writes/pick-item-write.ts';
import { pickNowWrite } from './writes/pick-now-write.ts';
import { runWrite } from './writes/run-write.ts';

// Parses the argv, finds the session, and runs the command. An expected outcome never throws: a
// refusal comes back as a result with its text on stderr.
export function runCLI(input: CLIInput): Promise<CLIResult> {
  return match(parseCLIArgs(input.argv))
    .with({ kind: 'refused' }, (refused) =>
      Promise.resolve(
        toRefusalResult(buildRefusal(refused.reason), {
          sessionFlag: refused.sessionFlag,
          typedWords: input.argv,
        }),
      ),
    )
    .with({ kind: 'args' }, (parsed) => runParsedArgs(input, parsed.args))
    .exhaustive();
}

function toRefusalResult(refusal: Refusal, scope: RefusalScope): CLIResult {
  return {
    exitCode: refusal.exitCode,
    stdout: '',
    stderr: formatRefusal(refusal, scope),
  };
}

const sessionCommands: ReadonlySet<string> = new Set(['init', 'attach', 'detach', 'sessions']);

async function runParsedArgs(input: CLIInput, args: ParsedArgs): Promise<CLIResult> {
  if (args.command === 'help') {
    return { exitCode: 0, stdout: helpText, stderr: '' };
  }

  const root = findStoreRoot(input.env);
  const nowMs = input.now();

  if (root === null) {
    // Listing sessions needs no session and is never refused: with no folder, there are none.
    return args.command === 'sessions'
      ? { exitCode: 0, stdout: `${formatSessionLines([], nowMs)}\n`, stderr: '' }
      : toRefusalResult(buildRefusal({ kind: 'no-store-folder' }), readRefusalScope(args));
  }

  const context = { args, env: input.env, cwd: input.cwd, nowMs, root };

  const result = sessionCommands.has(args.command)
    ? await runSessionCommand(context)
    : await runSessionBoundCommand(context);

  return result;
}

async function runSessionBoundCommand(context: CommandContext): Promise<CLIResult> {
  const resolution = await resolveSession({
    flag: context.args.sessionFlag,
    env: context.env,
    root: context.root,
  });

  return match(resolution)
    .with({ kind: 'found' }, (found) => runNamedSession(context, found.name))
    .with({ kind: 'none' }, () => refuseNoSession(context, null))
    .exhaustive();
}

async function runNamedSession(context: CommandContext, name: string): Promise<CLIResult> {
  const folder = join(context.root, name);
  const read = isSessionName(name) ? await readStore(folder) : { kind: 'missing' as const };

  return match(read)
    .with({ kind: 'store' }, (found) => runStoreCommand(context, found.store))
    .with({ kind: 'missing' }, () => refuseNoSession(context, name))
    .with({ kind: 'hand-kept' }, { kind: 'newer' }, (unreadable) =>
      toRefusalResult(
        buildReadRefusal(unreadable, { name, folder }),
        readRefusalScope(context.args),
      ),
    )
    .with({ kind: 'broken' }, (broken) =>
      broken.partial !== null && context.args.command === 'brief'
        ? runBriefCommand(broken.partial, context.nowMs, broken)
        : toRefusalResult(
            buildReadRefusal(broken, { name, folder }),
            readRefusalScope(context.args),
          ),
    )
    .exhaustive();
}

async function runStoreCommand(context: CommandContext, store: Store): Promise<CLIResult> {
  const args = context.args;

  if (args.command === 'brief') {
    return runBriefCommand(store, context.nowMs, null);
  }

  const pick = match(args.command)
    .with('goal', () => pickGoalWrite)
    .with('now', () => pickNowWrite)
    .with('done', 'drop', () => pickClose)
    .otherwise(() => pickItemWrite);

  const written = await runWrite({
    folder: store.folder,
    name: store.session.name,
    args,
    cwd: context.cwd,
    nowMs: context.nowMs,
    pick,
  });

  return match(written)
    .with({ kind: 'replied' }, (replied) => ({
      exitCode: 0 as const,
      stdout: `${replied.reply}\n`,
      stderr: '',
    }))
    .with({ kind: 'refused' }, (refused) =>
      toRefusalResult(refused.refusal, readRefusalScope(args)),
    )
    .exhaustive();
}

async function refuseNoSession(context: CommandContext, named: string | null): Promise<CLIResult> {
  const summaries = await readSessionSummaries(context.root);

  const refusal = buildRefusal({
    kind: 'no-session',
    named,
    sessions: summaries.map((summary) => ({
      name: summary.name,
      day: summary.started === null ? null : getSessionDay(summary.started, context.nowMs),
    })),
  });

  return toRefusalResult(refusal, readRefusalScope(context.args));
}
