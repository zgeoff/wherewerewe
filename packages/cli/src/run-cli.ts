import { join } from 'node:path';
import { match } from 'ts-pattern';
import { helpText } from './args/help-text.ts';
import { parseCLIArgs } from './args/parse-cli-args.ts';
import { getSessionDay } from './brief/get-session-day.ts';
import { runBriefCommand } from './commands/run-brief-command.ts';
import { runSessionCommand } from './commands/run-session-command.ts';
import type { CommandContext } from './commands/types.ts';
import { buildReadRefusal } from './refusals/build-read-refusal.ts';
import { buildRefusal } from './refusals/build-refusal.ts';
import { formatRefusal } from './refusals/format-refusal.ts';
import { isSessionName } from './rules/is-session-name.ts';
import { findAgentID } from './sessions/find-agent-id.ts';
import { readSessionSummaries } from './sessions/read-session-summaries.ts';
import { resolveSession } from './sessions/resolve-session.ts';
import { findStoreRoot } from './store/find-store-root.ts';
import { readStore } from './store/read-store.ts';
import type { CLIInput, CLIResult, ParsedArgs, Refusal, RefusalReason } from './types.ts';
import { pickClose } from './writes/pick-close.ts';
import { pickGoalWrite } from './writes/pick-goal-write.ts';
import { pickItemWrite } from './writes/pick-item-write.ts';
import { pickNowWrite } from './writes/pick-now-write.ts';
import { runWrite } from './writes/run-write.ts';

const sessionCommands: ReadonlySet<string> = new Set(['init', 'attach', 'detach', 'sessions']);

// Parses the argv, finds the session, and runs the command. An expected outcome never throws: a
// refusal comes back as a result with its text on stderr.
export async function runCLI(input: CLIInput): Promise<CLIResult> {
  const parsed = parseCLIArgs(input.argv);

  if (parsed.kind === 'refused') {
    return toRefusalResult(buildRefusal(parsed.reason), null);
  }

  const args = parsed.args;

  if (args.command === 'help') {
    return { exitCode: 0, stdout: helpText, stderr: '' };
  }

  const root = findStoreRoot(input.env);

  if (root === null) {
    return toRefusalResult(buildRefusal({ kind: 'no-store-folder' }), args);
  }

  const context = { args, env: input.env, cwd: input.cwd, nowMs: input.now(), root };

  const result = sessionCommands.has(args.command)
    ? await runSessionCommand(context)
    : await runSessionBoundCommand(context);

  return result;
}

function toRefusalResult(refusal: Refusal, args: ParsedArgs | null): CLIResult {
  return {
    exitCode: refusal.exitCode,
    stdout: '',
    stderr: formatRefusal(refusal, { sessionFlag: args?.sessionFlag ?? null }),
  };
}

async function runSessionBoundCommand(context: CommandContext): Promise<CLIResult> {
  const args = context.args;

  const resolution = await resolveSession({
    flag: args.sessionFlag,
    env: context.env,
    root: context.root,
  });

  const name = resolution.kind === 'found' ? resolution.name : null;
  const folder = name === null ? null : join(context.root, name);
  const isNamed = name !== null && folder !== null && isSessionName(name);
  const read = isNamed ? await readStore(folder) : { kind: 'missing' as const };

  if (name !== null && folder !== null) {
    const refusal = buildReadRefusal(read, { name, folder });

    if (refusal !== null) {
      return toRefusalResult(refusal, args);
    }
  }

  if (read.kind !== 'store' || name === null || folder === null) {
    const reason = await readNoSessionReason(context, name);

    return toRefusalResult(buildRefusal(reason), args);
  }

  if (args.command === 'brief') {
    return runBriefCommand(read.store, context.nowMs);
  }

  const pick = match(args.command)
    .with('goal', () => pickGoalWrite)
    .with('now', () => pickNowWrite)
    .with('done', 'drop', () => pickClose)
    .otherwise(() => pickItemWrite);

  const written = await runWrite({
    folder,
    name,
    args,
    cwd: context.cwd,
    nowMs: context.nowMs,
    pick,
  });

  return written.kind === 'replied'
    ? { exitCode: 0, stdout: `${written.reply}\n`, stderr: '' }
    : toRefusalResult(written.refusal, args);
}

async function readNoSessionReason(
  context: CommandContext,
  named: string | null,
): Promise<RefusalReason> {
  const summaries = await readSessionSummaries(context.root);

  return {
    kind: 'no-session',
    args: context.args,
    named,
    hasAgent: findAgentID(context.env) !== null,
    sessions: summaries.map((summary) => ({
      name: summary.name,
      day: summary.started === null ? null : getSessionDay(summary.started, context.nowMs),
    })),
  };
}
