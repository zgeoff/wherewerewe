import { join } from 'node:path';
import { match } from 'ts-pattern';
import { helpText } from './args/help-text.ts';
import { isWriteArgv, parseCLIArgs } from './args/parse-cli-args.ts';
import { formatDuplicateNotes } from './commands/format-duplicate-notes.ts';
import { formatSessionLines } from './commands/format-session-lines.ts';
import { refuseNoSession } from './commands/refuse-no-session.ts';
import { runBriefCommand } from './commands/run-brief-command.ts';
import { runGoalPasteCommand } from './commands/run-goal-paste-command.ts';
import { runImportCommand } from './commands/run-import-command.ts';
import { runListCommand } from './commands/run-list-command.ts';
import { runLogCommand } from './commands/run-log-command.ts';
import { runRecapCommand } from './commands/run-recap-command.ts';
import { runSessionCommand } from './commands/run-session-command.ts';
import { runShowCommand } from './commands/run-show-command.ts';
import { runTaskListCommand } from './commands/run-task-list-command.ts';
import type { CommandContext } from './commands/types.ts';
import { buildReadRefusal } from './refusals/build-read-refusal.ts';
import { buildRefusalResult } from './refusals/build-refusal-result.ts';
import { buildRefusalScope } from './refusals/build-refusal-scope.ts';
import { buildRefusal } from './refusals/build-refusal.ts';
import { findListKind } from './rules/find-list-kind.ts';
import { isOwnerTerminal } from './rules/is-owner-terminal.ts';
import { isSessionName } from './rules/is-session-name.ts';
import { redactCredentialWords } from './rules/redact-credential-words.ts';
import { findAgentID } from './sessions/find-agent-id.ts';
import { resolveSession } from './sessions/resolve-session.ts';
import { findStoreRoot } from './store/find-store-root.ts';
import { readStore } from './store/read-store.ts';
import type { CLIInput, CLIResult, CommandResult, ParsedArgs, Store, UnreadRows } from './types.ts';
import { pickAck } from './writes/pick-ack.ts';
import { pickClose } from './writes/pick-close.ts';
import { pickDecision } from './writes/pick-decision.ts';
import { pickGoalWrite } from './writes/pick-goal-write.ts';
import { pickGrantWrite } from './writes/pick-grant-write.ts';
import { pickItemWrite } from './writes/pick-item-write.ts';
import { pickLessonWrite } from './writes/pick-lesson-write.ts';
import { pickNowWrite } from './writes/pick-now-write.ts';
import { pickPromiseWrite } from './writes/pick-promise-write.ts';
import { pickSay } from './writes/pick-say.ts';
import { pickWordsWrite } from './writes/pick-words-write.ts';
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
    exitCode: result.exitCode,
    stdout: result.stdoutFormat === 'json' ? result.stdout : redactCredentialWords(result.stdout),
    stderr: redactCredentialWords(result.stderr),
  };
}

function runCommand(input: CLIInput): Promise<CommandResult> {
  return match(parseCLIArgs(input.argv))
    .with({ kind: 'refused' }, (refused) =>
      Promise.resolve(
        buildRefusalResult(buildRefusal(refused.reason), {
          sessionFlag: refused.sessionFlag,
          cwd: input.cwd,
          writes: isWriteArgv(input.argv),
        }),
      ),
    )
    .with({ kind: 'args' }, (parsed) => runParsedArgs(input, parsed.args))
    .exhaustive();
}

const ownerCommands: ReadonlySet<string> = new Set(['say', 'ack']);
const sessionCommands: ReadonlySet<string> = new Set(['init', 'attach', 'detach', 'sessions']);

async function runParsedArgs(input: CLIInput, args: ParsedArgs): Promise<CommandResult> {
  if (args.command === 'help') {
    return { exitCode: 0, stdout: helpText, stderr: '', stdoutFormat: 'text' };
  }

  if (args.command === 'hook') {
    return runHook(input, args);
  }

  if (args.command === 'install' || args.command === 'doctor') {
    return runSetup(input, args);
  }

  if (ownerCommands.has(args.command) && !isOwnerTerminal(input)) {
    return buildRefusalResult(
      buildRefusal({ kind: 'owner-only' }),
      buildRefusalScope(args, input.cwd),
    );
  }

  const root = findStoreRoot(input.env);
  const nowMs = input.now();

  if (root === null) {
    // Listing sessions needs no session and is never refused: with no folder, there are none.
    return args.command === 'sessions'
      ? {
          exitCode: 0,
          stdout: `${formatSessionLines([], nowMs)}\n`,
          stderr: '',
          stdoutFormat: 'text',
        }
      : buildRefusalResult(
          buildRefusal({ kind: 'no-store-folder' }),
          buildRefusalScope(args, input.cwd),
        );
  }

  const context = {
    args,
    env: input.env,
    cwd: input.cwd,
    nowMs,
    now: input.now,
    root,
    byOwner: isOwnerTerminal(input),
  };

  const result = await match(args.command)
    .with('import', async () => ({
      ...(await runImportCommand(context)),
      stdoutFormat: 'text' as const,
    }))
    .when(
      (command) => sessionCommands.has(command),
      async () => ({
        ...(await runSessionCommand(context)),
        stdoutFormat: 'text' as const,
      }),
    )
    .otherwise(() => runSessionBoundCommand(context));

  return result;
}

// The hook loads its own modules and no brief, check or write module, so a hook for an unbound
// agent session starts fast. It prints JSON or plain text that no word pass may touch.
async function runHook(input: CLIInput, args: ParsedArgs): Promise<CommandResult> {
  const root = findStoreRoot(input.env);
  const harness = args.positionals[0] === 'codex' ? 'codex' : 'claude';

  if (root === null) {
    return { exitCode: 0, stdout: '', stderr: '', stdoutFormat: 'json' };
  }

  const hookModule = await import('./commands/run-hook-command.ts');

  const result = await hookModule.runHookCommand(harness, input.stdin ?? '', {
    env: input.env,
    now: input.now,
    root,
    sleep: (delayMs) => Bun.sleep(delayMs),
    faultSleepMs: 6000,
    fault: null,
  });

  return { ...result, stdoutFormat: 'json' };
}

// install and doctor read no store and need no session. They load their own modules, so no other
// command pays for them.
async function runSetup(input: CLIInput, args: ParsedArgs): Promise<CommandResult> {
  if (args.command === 'doctor') {
    const doctorModule = await import('./commands/run-doctor-command.ts');

    return doctorModule.runDoctorCommand({ env: input.env, cwd: input.cwd });
  }

  const [installModule, versionModule] = await Promise.all([
    import('./commands/run-install-command.ts'),
    import('./install/get-package-version.ts'),
  ]);

  return installModule.runInstallCommand({
    env: input.env,
    cwd: input.cwd,
    isPrinting: args.values.print === true,
    isReplacingSkill: args.values['replace-skill'] === true,
    version: versionModule.getPackageVersion(),
  });
}

async function runSessionBoundCommand(context: CommandContext): Promise<CommandResult> {
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

const readCommands: ReadonlySet<string> = new Set(['brief', 'show', 'log', 'recap', 'list']);

async function runNamedSession(context: CommandContext, name: string): Promise<CommandResult> {
  if (context.args.command === 'goal' && context.args.values.paste === true) {
    return runGoalPasteCommand(context, name);
  }

  const folder = join(context.root, name);

  const read = isSessionName(name)
    ? await readStore(folder, { isPrsRead: context.args.command !== 'recap' })
    : { kind: 'missing' as const };

  return match(read)
    .with({ kind: 'store' }, (found) => runStoreCommand(context, found.store))
    .with({ kind: 'missing' }, () => refuseNoSession(context, name))
    .with({ kind: 'hand-kept' }, { kind: 'format-1' }, { kind: 'newer' }, (unreadable) =>
      buildRefusalResult(
        buildReadRefusal(unreadable, { name, folder }),
        buildRefusalScope(context.args, context.cwd),
      ),
    )
    .with({ kind: 'broken' }, (broken) =>
      broken.partial !== null && readCommands.has(context.args.command)
        ? runReadCommand(context, broken.partial, broken)
        : buildRefusalResult(
            buildReadRefusal(broken, { name, folder }),
            buildRefusalScope(context.args, context.cwd),
          ),
    )
    .exhaustive();
}

async function runStoreCommand(context: CommandContext, store: Store): Promise<CommandResult> {
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
      host: findHost(context),
      pick: args.command === 'say' ? pickSay : pickAck,
    });

    return resolveWriteResult(owned, args, context.cwd);
  }

  const pick = match(args.command)
    .with('goal', () => pickGoalWrite)
    .with(
      'grant',
      () => (writeInput: WriteInput) => pickGrantWrite({ ...writeInput, byOwner: context.byOwner }),
    )
    .with('lesson', () => pickLessonWrite)
    .with('promise', () => pickPromiseWrite)
    .with(
      'words',
      () => (writeInput: WriteInput) => pickWordsWrite({ ...writeInput, byOwner: context.byOwner }),
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
    env: context.env,
    nowMs: context.nowMs,
    host: findHost(context),
    pick,
  });

  return resolveWriteResult(written, args, context.cwd);
}

async function runReadCommand(
  context: CommandContext,
  store: Store,
  unread: UnreadRows | null,
): Promise<CommandResult> {
  const result = await runReadCommandBody(context, store, unread);

  return { ...result, stderr: `${result.stderr}${formatDuplicateNotes(store)}` };
}

function runReadCommandBody(
  context: CommandContext,
  store: Store,
  unread: UnreadRows | null,
): Promise<CommandResult> {
  const args = context.args;

  return match(args.command)
    .with('show', () => {
      const [id] = args.positionals;

      return id === undefined
        ? runTaskListCommand(store, context, unread)
        : runShowCommand(store, id, context, unread);
    })
    .with('list', () => {
      const kind = findListKind(args.positionals[0]);

      if (kind === null) {
        throw new Error('the parser refuses a kind that list does not take');
      }

      return runListCommand(store, kind, context, unread);
    })
    .with('log', () => runLogCommand(store, args, context, unread))
    .with('recap', () => runRecapCommand(store, args, context, unread))
    .otherwise(() => runBriefCommand(store, context, unread, findHost(context)));
}

function findHost(context: CommandContext): 'claude' | 'codex' | null {
  return findAgentID(context.env)?.harness ?? null;
}

function resolveWriteResult(written: RunWriteResult, args: ParsedArgs, cwd: string): CommandResult {
  return match(written)
    .with({ kind: 'replied' }, (replied) => ({
      exitCode: 0 as const,
      stdout: `${replied.reply}\n`,
      stderr: '',
      stdoutFormat: 'text' as const,
    }))
    .with({ kind: 'refused' }, (refused) =>
      buildRefusalResult(refused.refusal, buildRefusalScope(args, cwd)),
    )
    .exhaustive();
}
