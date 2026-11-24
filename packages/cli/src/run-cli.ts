import { join } from 'node:path';
import { match } from 'ts-pattern';
import { helpText } from './args/help-text.ts';
import { parseCLIArgs } from './args/parse-cli-args.ts';
import { getSessionDay } from './brief/get-session-day.ts';
import { formatSessionLines } from './commands/format-session-lines.ts';
import { runBriefCommand } from './commands/run-brief-command.ts';
import { runImportCommand } from './commands/run-import-command.ts';
import { runLogCommand } from './commands/run-log-command.ts';
import { runSessionCommand } from './commands/run-session-command.ts';
import { runShowCommand } from './commands/run-show-command.ts';
import type { CommandContext } from './commands/types.ts';
import { buildReadRefusal } from './refusals/build-read-refusal.ts';
import { buildRefusalResult } from './refusals/build-refusal-result.ts';
import { buildRefusalScope } from './refusals/build-refusal-scope.ts';
import { buildRefusal } from './refusals/build-refusal.ts';
import { isOwnerTerminal } from './rules/is-owner-terminal.ts';
import { isSessionName } from './rules/is-session-name.ts';
import { redactCredentialWords } from './rules/redact-credential-words.ts';
import { readSessionSummaries } from './sessions/read-session-summaries.ts';
import { resolveSession } from './sessions/resolve-session.ts';
import { findStoreRoot } from './store/find-store-root.ts';
import { readStore } from './store/read-store.ts';
import type { CLIInput, CLIResult, ParsedArgs, Store, UnreadRows } from './types.ts';
import { pickAck } from './writes/pick-ack.ts';
import { pickClose } from './writes/pick-close.ts';
import { pickDecision } from './writes/pick-decision.ts';
import { pickGoalWrite } from './writes/pick-goal-write.ts';
import { pickGrantWrite } from './writes/pick-grant-write.ts';
import { pickItemWrite } from './writes/pick-item-write.ts';
import { pickNowWrite } from './writes/pick-now-write.ts';
import { pickSay } from './writes/pick-say.ts';
import { runOwnerWrite } from './writes/run-owner-write.ts';
import { runWrite } from './writes/run-write.ts';
import type { RunWriteResult } from './writes/run-write.ts';
import type { WriteInput } from './writes/types.ts';

// Parses the argv, finds the session, and runs the command. An expected outcome never throws: a
// refusal comes back as a result with its text on stderr. Every output line passes through the
// credential test here, so no path prints a word that looks like a credential.
export async function runCLI(input: CLIInput): Promise<CLIResult> {
  const result = await runCommand(input);

  return {
    ...result,
    stdout: redactCredentialWords(result.stdout),
    stderr: redactCredentialWords(result.stderr),
  };
}

function runCommand(input: CLIInput): Promise<CLIResult> {
  return match(parseCLIArgs(input.argv))
    .with({ kind: 'refused' }, (refused) =>
      Promise.resolve(
        buildRefusalResult(buildRefusal(refused.reason), {
          sessionFlag: refused.sessionFlag,
          typedWords: input.argv,
        }),
      ),
    )
    .with({ kind: 'args' }, (parsed) => runParsedArgs(input, parsed.args))
    .exhaustive();
}

const ownerCommands: ReadonlySet<string> = new Set(['say', 'ack']);
const sessionCommands: ReadonlySet<string> = new Set(['init', 'attach', 'detach', 'sessions']);

async function runParsedArgs(input: CLIInput, args: ParsedArgs): Promise<CLIResult> {
  if (args.command === 'help') {
    return { exitCode: 0, stdout: helpText, stderr: '' };
  }

  if (ownerCommands.has(args.command) && !isOwnerTerminal(input)) {
    return buildRefusalResult(buildRefusal({ kind: 'owner-only' }), buildRefusalScope(args));
  }

  const root = findStoreRoot(input.env);
  const nowMs = input.now();

  if (root === null) {
    // Listing sessions needs no session and is never refused: with no folder, there are none.
    return args.command === 'sessions'
      ? { exitCode: 0, stdout: `${formatSessionLines([], nowMs)}\n`, stderr: '' }
      : buildRefusalResult(buildRefusal({ kind: 'no-store-folder' }), buildRefusalScope(args));
  }

  const context = {
    args,
    env: input.env,
    cwd: input.cwd,
    nowMs,
    root,
    byOwner: isOwnerTerminal(input),
  };

  const result = await match(args.command)
    .with('import', () => runImportCommand(context))
    .when(
      (command) => sessionCommands.has(command),
      () => runSessionCommand(context),
    )
    .otherwise(() => runSessionBoundCommand(context));

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

const readCommands: ReadonlySet<string> = new Set(['brief', 'show', 'log']);

async function runNamedSession(context: CommandContext, name: string): Promise<CLIResult> {
  const folder = join(context.root, name);
  const read = isSessionName(name) ? await readStore(folder) : { kind: 'missing' as const };

  return match(read)
    .with({ kind: 'store' }, (found) => runStoreCommand(context, found.store))
    .with({ kind: 'missing' }, () => refuseNoSession(context, name))
    .with({ kind: 'hand-kept' }, { kind: 'format-1' }, { kind: 'newer' }, (unreadable) =>
      buildRefusalResult(
        buildReadRefusal(unreadable, { name, folder }),
        buildRefusalScope(context.args),
      ),
    )
    .with({ kind: 'broken' }, (broken) =>
      broken.partial !== null && readCommands.has(context.args.command)
        ? runReadCommand(context, broken.partial, broken)
        : buildRefusalResult(
            buildReadRefusal(broken, { name, folder }),
            buildRefusalScope(context.args),
          ),
    )
    .exhaustive();
}

async function runStoreCommand(context: CommandContext, store: Store): Promise<CLIResult> {
  const args = context.args;

  if (readCommands.has(args.command)) {
    return runReadCommand(context, store, null);
  }

  if (ownerCommands.has(args.command)) {
    const owned = await runOwnerWrite({
      folder: store.folder,
      name: store.session.name,
      args,
      cwd: context.cwd,
      nowMs: context.nowMs,
      pick: args.command === 'say' ? pickSay : pickAck,
    });

    return resolveWriteResult(owned, args);
  }

  const pick = match(args.command)
    .with('goal', () => pickGoalWrite)
    .with(
      'grant',
      () => (writeInput: WriteInput) => pickGrantWrite({ ...writeInput, byOwner: context.byOwner }),
    )
    .with('now', () => pickNowWrite)
    .with('done', 'drop', 'use', () => pickClose)
    .with('decide', () => pickDecision)
    .otherwise(() => pickItemWrite);

  const written = await runWrite({
    folder: store.folder,
    name: store.session.name,
    args,
    cwd: context.cwd,
    nowMs: context.nowMs,
    pick,
  });

  return resolveWriteResult(written, args);
}

function runReadCommand(
  context: CommandContext,
  store: Store,
  unread: UnreadRows | null,
): Promise<CLIResult> {
  const args = context.args;

  return match(args.command)
    .with('show', () => runShowCommand(store, args.positionals[0] ?? '', context.nowMs, unread))
    .with('log', () => runLogCommand(store, args, context.nowMs, unread))
    .otherwise(() => Promise.resolve(runBriefCommand(store, context.nowMs, unread)));
}

function resolveWriteResult(written: RunWriteResult, args: ParsedArgs): CLIResult {
  return match(written)
    .with({ kind: 'replied' }, (replied) => ({
      exitCode: 0 as const,
      stdout: `${replied.reply}\n`,
      stderr: '',
    }))
    .with({ kind: 'refused' }, (refused) =>
      buildRefusalResult(refused.refusal, buildRefusalScope(args)),
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

  return buildRefusalResult(refusal, buildRefusalScope(context.args));
}
