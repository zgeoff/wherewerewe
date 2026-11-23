import { join } from 'node:path';
import { match } from 'ts-pattern';
import { formatTimestamp } from '../format-timestamp.ts';
import { buildReadRefusal } from '../refusals/build-read-refusal.ts';
import { buildRefusal } from '../refusals/build-refusal.ts';
import { formatRefusal } from '../refusals/format-refusal.ts';
import { readRefusalScope } from '../refusals/read-refusal-scope.ts';
import { isSessionName } from '../rules/is-session-name.ts';
import { buildBindRow } from '../sessions/build-bind-row.ts';
import { findAgentID } from '../sessions/find-agent-id.ts';
import { readBinding } from '../sessions/read-binding.ts';
import { readSessionSummaries } from '../sessions/read-session-summaries.ts';
import { removeBinding } from '../sessions/remove-binding.ts';
import { withBindingLock } from '../sessions/with-binding-lock.ts';
import { writeBinding } from '../sessions/write-binding.ts';
import { createSessionStore } from '../store/create-session-store.ts';
import { readStore } from '../store/read-store.ts';
import { withStoreLock } from '../store/with-store-lock.ts';
import type { LockResult } from '../store/with-store-lock.ts';
import { writeStoreFiles } from '../store/write-store-files.ts';
import type { AgentID, CLIResult, JournalRow, Refusal } from '../types.ts';
import { pickTextRefusal } from '../writes/pick-text-refusal.ts';
import { formatSessionLines } from './format-session-lines.ts';
import type { CommandContext } from './types.ts';

// init, attach, detach and sessions: the commands that need no resolved session.
export function runSessionCommand(context: CommandContext): Promise<CLIResult> {
  return match(context.args.command)
    .with('init', () => runInit(context))
    .with('attach', () => runAttach(context))
    .with('detach', () => runDetach(context))
    .otherwise(() => runSessions(context));
}

async function runInit(context: CommandContext): Promise<CLIResult> {
  const args = context.args;
  const nowMs = context.nowMs;
  const root = context.root;
  const name = args.positionals[0] ?? '';
  const goal = args.values.goal;
  const agent = findAgentID(context.env);

  if (!isSessionName(name)) {
    return replyRefusal(buildRefusal({ kind: 'bad-session-name', args, name }), context);
  }

  if (goal === undefined) {
    return replyRefusal(buildRefusal({ kind: 'needs-goal', args }), context);
  }

  const reason = pickTextRefusal(
    args,
    [{ target: { label: 'goal', place: { flag: 'goal' } }, text: goal, limit: 200 }],
    false,
  );

  if (reason !== null) {
    return replyRefusal(buildRefusal(reason), context);
  }

  const ts = formatTimestamp(nowMs);

  const rows: JournalRow[] = [
    { ts, op: 'init', id: name, by: 'agent', text: goal, why: null, extra: null },
    ...(agent === null ? [] : [buildBindRow(name, 'init', agent, nowMs)]),
  ];

  const created = await createSessionStore(
    root,
    {
      format: '1',
      name,
      goal,
      started: ts,
      now: null,
      nowNext: null,
      nowSet: null,
      lastWrite: ts,
      lastNudge: null,
      importedFrom: null,
    },
    rows,
  );

  return match(created)
    .with('exists', () => replyRefusal(buildRefusal({ kind: 'session-exists', name }), context))
    .with('created', () => replyStarted(root, agent, name))
    .exhaustive();
}

function replyRefusal(refusal: Refusal, context: CommandContext): CLIResult {
  return {
    exitCode: refusal.exitCode,
    stdout: '',
    stderr: formatRefusal(refusal, readRefusalScope(context.args)),
  };
}

async function replyStarted(root: string, agent: AgentID | null, name: string): Promise<CLIResult> {
  const folder = join(root, name);

  if (agent === null) {
    return replyOK(
      `Started session ${name} in ${folder}. Name it on each command: www --session ${name}`,
    );
  }

  await withBindingLock(root, () => writeBinding(root, agent, name));

  return replyOK(
    `Started session ${name} in ${folder}. Bound to this ${readHarnessLabel(agent)} session.`,
  );
}

function replyOK(text: string): CLIResult {
  return { exitCode: 0, stdout: `${text}\n`, stderr: '' };
}

function readHarnessLabel(agent: AgentID): string {
  return match(agent.harness)
    .with('claude', () => 'Claude Code')
    .with('codex', () => 'Codex')
    .exhaustive();
}

async function runAttach(context: CommandContext): Promise<CLIResult> {
  const name = context.args.positionals[0] ?? '';
  const agent = findAgentID(context.env);

  if (agent === null) {
    return replyRefusal(buildRefusal({ kind: 'no-agent-id', name }), context);
  }

  const folder = join(context.root, name);
  const read = isSessionName(name) ? await readStore(folder) : { kind: 'missing' as const };

  return match(read)
    .with({ kind: 'store' }, () => attachToStore(context, agent, name))
    .with({ kind: 'missing' }, async () => {
      const summaries = await readSessionSummaries(context.root);

      const sessions = summaries.map((summary) => summary.name);

      return replyRefusal(buildRefusal({ kind: 'attach-no-session', name, sessions }), context);
    })
    .with({ kind: 'hand-kept' }, { kind: 'newer' }, { kind: 'broken' }, (unreadable) =>
      replyRefusal(buildReadRefusal(unreadable, { name, folder }), context),
    )
    .exhaustive();
}

async function attachToStore(
  context: CommandContext,
  agent: AgentID,
  name: string,
): Promise<CLIResult> {
  const folder = join(context.root, name);

  const locked = await withStoreAndBindingLock(folder, context.root, async () => {
    await writeStoreFiles(folder, {
      journal: [buildBindRow(name, 'attach', agent, context.nowMs)],
    });

    await writeBinding(context.root, agent, name);
  });

  return match(locked)
    .with({ kind: 'ran' }, () =>
      replyOK(`Bound this ${readHarnessLabel(agent)} session to ${name}.`),
    )
    .with({ kind: 'busy' }, (busy) =>
      replyRefusal(
        buildRefusal({ kind: 'lock-busy', args: context.args, name, pid: busy.pid }),
        context,
      ),
    )
    .exhaustive();
}

// Takes the session's lock, then the binding lock, always in that order, and runs `fn` under both.
async function withStoreAndBindingLock<Value>(
  folder: string,
  root: string,
  fn: () => Promise<Value>,
): Promise<LockResult<Value>> {
  const outer = await withStoreLock(folder, () => withBindingLock(root, fn), { waitMs: 2000 });

  return outer.kind === 'ran' ? outer.value : outer;
}

async function runDetach(context: CommandContext): Promise<CLIResult> {
  const agent = findAgentID(context.env);

  if (agent === null) {
    return replyRefusal(
      buildRefusal({ kind: 'no-agent-id', name: context.args.sessionFlag }),
      context,
    );
  }

  const name = await readBinding(context.root, agent);

  if (name === null) {
    return replyRefusal(
      buildRefusal({ kind: 'detach-no-binding', harness: agent.harness }),
      context,
    );
  }

  const outcome = await detachFrom(context, agent, name);

  return match(outcome)
    .with({ kind: 'unbound' }, () =>
      replyOK(`Unbound this ${readHarnessLabel(agent)} session from ${name}.`),
    )
    .with({ kind: 'moved' }, () => runDetach(context))
    .with({ kind: 'busy' }, (busy) =>
      replyRefusal(
        buildRefusal({ kind: 'lock-busy', args: context.args, name, pid: busy.pid }),
        context,
      ),
    )
    .exhaustive();
}

type DetachOutcome =
  | { readonly kind: 'unbound' }
  | { readonly kind: 'moved' }
  | { readonly kind: 'busy'; readonly pid: number | null };

// Takes the lock of the session the binding named, then the binding lock, and reads the binding
// again: an attach that ran in between moved it, and this detach starts over on the session it
// names now. A binding changes only under the binding lock, so it cannot move before the delete.
async function detachFrom(
  context: CommandContext,
  agent: AgentID,
  name: string,
): Promise<DetachOutcome> {
  const folder = join(context.root, name);
  const read = isSessionName(name) ? await readStore(folder) : { kind: 'missing' as const };

  return match(read)
    .with({ kind: 'store' }, async () => {
      const locked = await withStoreAndBindingLock(folder, context.root, () =>
        removeBoundBinding(context, agent, name, () =>
          writeStoreFiles(folder, {
            journal: [buildBindRow(name, 'detach', agent, context.nowMs)],
          }),
        ),
      );

      return match(locked)
        .with({ kind: 'ran' }, (ran) => ran.value)
        .with({ kind: 'busy' }, (busy): DetachOutcome => ({ kind: 'busy', pid: busy.pid }))
        .exhaustive();
    })
    .with(
      { kind: 'missing' },
      { kind: 'hand-kept' },
      { kind: 'newer' },
      { kind: 'broken' },
      async () => {
        const locked = await withBindingLock(context.root, () =>
          removeBoundBinding(context, agent, name, () => Promise.resolve()),
        );

        return match(locked)
          .with({ kind: 'ran' }, (ran) => ran.value)
          .with({ kind: 'busy' }, (busy): DetachOutcome => ({ kind: 'busy', pid: busy.pid }))
          .exhaustive();
      },
    )
    .exhaustive();
}

async function removeBoundBinding(
  context: CommandContext,
  agent: AgentID,
  name: string,
  writeJournal: () => Promise<void>,
): Promise<DetachOutcome> {
  if ((await readBinding(context.root, agent)) !== name) {
    return { kind: 'moved' };
  }

  await writeJournal();
  await removeBinding(context.root, agent);

  return { kind: 'unbound' };
}

async function runSessions(context: CommandContext): Promise<CLIResult> {
  const summaries = await readSessionSummaries(context.root);

  return replyOK(formatSessionLines(summaries, context.nowMs));
}
