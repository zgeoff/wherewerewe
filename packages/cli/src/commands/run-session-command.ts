import { join } from 'node:path';
import { match } from 'ts-pattern';
import { formatAge } from '../brief/format-age.ts';
import { getSessionDay } from '../brief/get-session-day.ts';
import { formatTimestamp } from '../format-timestamp.ts';
import { buildReadRefusal } from '../refusals/build-read-refusal.ts';
import { buildRefusal } from '../refusals/build-refusal.ts';
import { formatRefusal } from '../refusals/format-refusal.ts';
import { isSessionName } from '../rules/is-session-name.ts';
import { findAgentID } from '../sessions/find-agent-id.ts';
import { readBinding } from '../sessions/read-binding.ts';
import { readSessionSummaries } from '../sessions/read-session-summaries.ts';
import { removeBinding } from '../sessions/remove-binding.ts';
import { writeBinding } from '../sessions/write-binding.ts';
import { createSessionStore } from '../store/create-session-store.ts';
import { readStore } from '../store/read-store.ts';
import { withStoreLock } from '../store/with-store-lock.ts';
import { writeStoreFiles } from '../store/write-store-files.ts';
import type { AgentID, CLIResult, JournalRow, Refusal, SessionSummary } from '../types.ts';
import { pickTextRefusal } from '../writes/pick-text-refusal.ts';
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

  if (created === 'exists') {
    return replyRefusal(
      buildRefusal({ kind: 'session-exists', args, name, hasAgent: agent !== null }),
      context,
    );
  }

  const folder = join(root, name);

  if (agent === null) {
    return replyOK(
      `Started session ${name} in ${folder}. Name it on each command: www --session ${name}`,
    );
  }

  await writeBinding(root, agent, name);

  return replyOK(
    `Started session ${name} in ${folder}. Bound to this ${readHarnessLabel(agent)} session.`,
  );
}

function replyRefusal(refusal: Refusal, context: CommandContext): CLIResult {
  return {
    exitCode: refusal.exitCode,
    stdout: '',
    stderr: formatRefusal(refusal, context.args),
  };
}

function buildBindRow(name: string, text: string, agent: AgentID, nowMs: number): JournalRow {
  return {
    ts: formatTimestamp(nowMs),
    op: 'bind',
    id: name,
    by: 'agent',
    text,
    why: null,
    extra: `harness=${agent.harness};agent=${agent.id}`,
  };
}

function replyOK(text: string): CLIResult {
  return { exitCode: 0, stdout: `${text}\n`, stderr: '' };
}

function readHarnessLabel(agent: AgentID): string {
  return agent.harness === 'claude' ? 'Claude Code' : 'Codex';
}

async function runAttach(context: CommandContext): Promise<CLIResult> {
  const args = context.args;
  const nowMs = context.nowMs;
  const root = context.root;
  const name = args.positionals[0] ?? '';
  const agent = findAgentID(context.env);

  if (agent === null) {
    return replyRefusal(buildRefusal({ kind: 'no-agent-id', command: 'attach', name }), context);
  }

  const folder = join(root, name);
  const read = isSessionName(name) ? await readStore(folder) : { kind: 'missing' as const };

  if (read.kind === 'missing') {
    const summaries = await readSessionSummaries(root);

    const sessions = summaries.map((summary) => summary.name);

    return replyRefusal(buildRefusal({ kind: 'attach-no-session', name, sessions }), context);
  }

  const readRefusal = buildReadRefusal(read, { name, folder });

  if (readRefusal !== null) {
    return replyRefusal(readRefusal, context);
  }

  const locked = await withStoreLock(
    folder,
    async () => {
      await writeStoreFiles(folder, { journal: [buildBindRow(name, 'attach', agent, nowMs)] });
      await writeBinding(root, agent, name);
    },
    { waitMs: 2000 },
  );

  if (locked.kind === 'busy') {
    return replyRefusal(buildRefusal({ kind: 'lock-busy', args, name, pid: locked.pid }), context);
  }

  return replyOK(`Bound this ${readHarnessLabel(agent)} session to ${name}.`);
}

async function runDetach(context: CommandContext): Promise<CLIResult> {
  const args = context.args;
  const nowMs = context.nowMs;
  const root = context.root;
  const agent = findAgentID(context.env);

  if (agent === null) {
    return replyRefusal(
      buildRefusal({ kind: 'no-agent-id', command: 'detach', name: null }),
      context,
    );
  }

  const name = await readBinding(root, agent);

  if (name === null) {
    return replyRefusal(
      buildRefusal({ kind: 'detach-no-binding', harness: agent.harness }),
      context,
    );
  }

  const folder = join(root, name);
  const read = isSessionName(name) ? await readStore(folder) : { kind: 'missing' as const };

  if (read.kind !== 'store') {
    await removeBinding(root, agent);

    return replyOK(`Unbound this ${readHarnessLabel(agent)} session from ${name}.`);
  }

  const locked = await withStoreLock(
    folder,
    async () => {
      await writeStoreFiles(folder, { journal: [buildBindRow(name, 'detach', agent, nowMs)] });
      await removeBinding(root, agent);
    },
    { waitMs: 2000 },
  );

  if (locked.kind === 'busy') {
    return replyRefusal(buildRefusal({ kind: 'lock-busy', args, name, pid: locked.pid }), context);
  }

  return replyOK(`Unbound this ${readHarnessLabel(agent)} session from ${name}.`);
}

async function runSessions(context: CommandContext): Promise<CLIResult> {
  const summaries = await readSessionSummaries(context.root);

  if (summaries.length === 0) {
    return replyOK(
      'No sessions on this machine yet. Run: www init <name> --goal "<what done means>"',
    );
  }

  const width = Math.max(...summaries.map((summary) => summary.name.length));

  return replyOK(
    summaries.map((summary) => formatSummaryLine(summary, width, context.nowMs)).join('\n'),
  );
}

function formatSummaryLine(summary: SessionSummary, width: number, nowMs: number): string {
  const name = summary.name.padEnd(width);

  if (summary.format === '0-by-hand') {
    return `  ${name}  hand-kept: run www import ${summary.name}`;
  }

  if (summary.format === null || summary.started === null || summary.goal === null) {
    return `  ${name}  unreadable session file`;
  }

  if (summary.format !== '1') {
    return `  ${name}  format ${summary.format}: this www reads format 1`;
  }

  const lastWrite =
    summary.lastWrite === null
      ? 'last write never'
      : `last write ${formatAge(nowMs - Date.parse(summary.lastWrite))} ago`;

  const goalChars = [...summary.goal];
  const goal = goalChars.length > 60 ? `${goalChars.slice(0, 60).join('')}…` : summary.goal;

  return `  ${name}  day ${String(getSessionDay(summary.started, nowMs))}  ${lastWrite}  ${goal}`;
}
