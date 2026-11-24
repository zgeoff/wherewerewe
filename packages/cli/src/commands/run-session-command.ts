import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { match } from 'ts-pattern';
import { formatTimestamp } from '../format-timestamp.ts';
import { findFormat } from '../import/find-format.ts';
import { buildReadRefusal } from '../refusals/build-read-refusal.ts';
import { buildRefusalResult } from '../refusals/build-refusal-result.ts';
import { buildRefusalScope } from '../refusals/build-refusal-scope.ts';
import { buildRefusal } from '../refusals/build-refusal.ts';
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
import { pickInitArgsRefusal } from '../writes/pick-init-args-refusal.ts';
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
  const reason = pickInitArgsRefusal(args);

  if (reason !== null || goal === undefined) {
    return replyRefusal(buildRefusal(reason ?? { kind: 'needs-goal', args }), context);
  }

  const ts = formatTimestamp(nowMs);

  const rows: JournalRow[] = [
    { ts, op: 'init', id: name, by: 'agent', text: goal, why: null, extra: null },
    ...(agent === null ? [] : [buildBindRow(name, 'init', agent, nowMs)]),
  ];

  const createStore = () =>
    createSessionStore(
      root,
      {
        format: '2',
        name,
        goal,
        grant: null,
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

  const folder = join(root, name);

  const hasFormat1 = await probeFormat1Folder(folder);

  if (hasFormat1) {
    return replyRefusal(buildRefusal({ kind: 'format-1', name }), context);
  }

  if (agent === null) {
    const created = await createStore();

    return match(created)
      .with('exists', () => replyRefusal(buildRefusal({ kind: 'session-exists', name }), context))
      .with('created', () =>
        replyOK(
          `Started session ${name} in ${folder}. Name it on each command: www --session ${name}`,
        ),
      )
      .exhaustive();
  }

  // The binding lock comes first, so a busy lock creates no store and no bind row, and the refusal's
  // Run line, the same init, starts the session.
  const locked = await withBindingLock(root, async () => {
    const created = await createStore();

    if (created === 'created') {
      await writeBinding(root, agent, name);
    }

    return created;
  });

  return match(locked)
    .with({ kind: 'ran', value: 'exists' }, () =>
      replyRefusal(buildRefusal({ kind: 'session-exists', name }), context),
    )
    .with({ kind: 'ran', value: 'created' }, () =>
      replyOK(
        `Started session ${name} in ${folder}. Bound to this ${readHarnessLabel(agent)} session.`,
      ),
    )
    .with({ kind: 'busy' }, (busy) =>
      replyRefusal(buildRefusal({ kind: 'lock-busy', args, name, pid: busy.pid }), context),
    )
    .exhaustive();
}

function replyRefusal(refusal: Refusal, context: CommandContext): CLIResult {
  return buildRefusalResult(refusal, buildRefusalScope(context.args, context.cwd));
}

// The refusal of a format 1 store names its upgrade, which the session-exists refusal's own Run
// line, www attach, could not run.
async function probeFormat1Folder(folder: string): Promise<boolean> {
  const text = await readFile(join(folder, 'session'), 'utf8').catch(() => null);

  return text !== null && findFormat(text) === '1';
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
    .with(
      { kind: 'hand-kept' },
      { kind: 'format-1' },
      { kind: 'newer' },
      { kind: 'broken' },
      (unreadable) => replyRefusal(buildReadRefusal(unreadable, { name, folder }), context),
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
    .with({ kind: 'format-1' }, () =>
      replyRefusal(buildRefusal({ kind: 'format-1', name }), context),
    )
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
  | { readonly kind: 'format-1' }
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
    .with({ kind: 'format-1' }, (): Promise<DetachOutcome> => Promise.resolve({ kind: 'format-1' }))
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
