import { match } from 'ts-pattern';
import { getKindWord } from '../rules/get-kind-word.ts';
import { isItemID } from '../rules/is-item-id.ts';
import { isSessionName } from '../rules/is-session-name.ts';
import { redactCredential } from '../rules/redact-credential.ts';
import type { ParsedArgs, Placeholder, Refusal, RefusalReason, RunWord } from '../types.ts';
import { buildApprovalRefusal } from './build-approval-refusal.ts';
import { buildArgvRefusal } from './build-argv-refusal.ts';
import { buildCheckValueRefusal } from './build-check-value-refusal.ts';
import { buildKindRefusal } from './build-kind-refusal.ts';
import { buildNoteRefusal } from './build-note-refusal.ts';
import { buildOwnerRefusal } from './build-owner-refusal.ts';
import { buildRunSpec } from './build-run-spec.ts';
import type { RunSpec } from './build-run-spec.ts';
import { buildTooLongRefusal } from './build-too-long-refusal.ts';
import { buildUpgradeRefusal } from './build-upgrade-refusal.ts';
import { formatList } from './format-list.ts';
import { grantPlaceholders } from './grant-placeholders.ts';
import { pickClosestID } from './pick-closest-id.ts';
import { refuse } from './refuse.ts';
import { replaceText } from './replace-text.ts';
import { runPlaceholders } from './run-placeholders.ts';
import { toPlaceholder } from './to-placeholder.ts';

// Every refusal text and its Run lines live here, so each has one place to read and to test.
export function buildRefusal(reason: RefusalReason): Refusal {
  return match(reason)
    .with({ kind: 'no-store-folder' }, () =>
      usage(4, 'www: no store folder: set XDG_STATE_HOME or HOME.'),
    )
    .with(
      { kind: 'unknown-command' },
      { kind: 'flag-needs-value' },
      { kind: 'flag-value-has-dash' },
      { kind: 'flag-takes-no-value' },
      { kind: 'flag-not-taken' },
      { kind: 'wrong-positionals' },
      { kind: 'goal-paste-with-text' },
      { kind: 'bad-list-kind' },
      (found) => buildArgvRefusal(found),
    )
    .with({ kind: 'text-too-long' }, (found) => buildTooLongRefusal(found))
    .with({ kind: 'text-not-one-line' }, (found) =>
      refuse(
        'www: refused: the text must be one line, with no tab or newline.',
        replaceText(found.args, found.target, toPlaceholder('<one line>')),
      ),
    )
    .with({ kind: 'text-empty' }, (found) =>
      refuse(
        `www: refused: the ${found.target.label} is empty.`,
        replaceText(found.args, found.target, toPlaceholder(`<${found.target.label}>`)),
      ),
    )
    .with({ kind: 'credential' }, (found) =>
      refuse(
        `www: refused: the text looks like a credential (it matches the ${found.label} pattern). Write where the secret lives, never its value.`,
        buildCredentialRun(found),
      ),
    )
    .with(
      { kind: 'owed-needs-note' },
      { kind: 'note-and-no-note' },
      { kind: 'set-needs-change' },
      { kind: 'set-check-needs-claim' },
      { kind: 'no-note-to-clear' },
      { kind: 'owed-note' },
      (found) => buildNoteRefusal(found),
    )
    .with({ kind: 'needs-evidence' }, (found) =>
      refuse(
        'www: refused: done needs evidence a reader can open, such as a PR, a commit or a test run. For work you stopped, use drop.',
        buildRunSpec(found.args).addFlag('evidence', runPlaceholders.evidence).toArgv(),
      ),
    )
    .with({ kind: 'needs-reason' }, (found) =>
      refuse(
        'www: refused: drop needs a reason.',
        buildRunSpec(found.args).addFlag('why', runPlaceholders.reason).toArgv(),
      ),
    )
    .with({ kind: 'needs-who' }, (found) =>
      refuse(
        'www: refused: a wait names who it waits on.',
        buildRunSpec(found.args).addFlag('who', toPlaceholder('<who>')).toArgv(),
      ),
    )
    .with({ kind: 'extra-has-separator' }, (found) =>
      refuse(
        `www: refused: --${found.flag} cannot hold ; or =.`,
        buildRunSpec(found.args)
          .replaceFlag(found.flag, found.value.replaceAll(/[;=]/gu, ','))
          .toArgv(),
      ),
    )
    .with(
      { kind: 'ok-needs-parts' },
      { kind: 'ok-standing' },
      { kind: 'grant-needs-part' },
      { kind: 'grant-reading-no-grant' },
      { kind: 'grant-words-too-long' },
      { kind: 'grant-too-many-bullets' },
      { kind: 'grant-too-many-lines' },
      { kind: 'text-has-mark' },
      (found) => buildApprovalRefusal(found),
    )
    .with({ kind: 'no-grant-to-print' }, (found) => ({
      exitCode: 3 as const,
      lines: [`www: refused: ${found.name} has no grant to print.`],
      runs: [
        {
          usage: `grant --may "${grantPlaceholders.may.placeholder}" --where <where> --reading "${grantPlaceholders.reading.placeholder}"`,
        },
      ],
    }))
    .with({ kind: 'decide-needs-why' }, (found) =>
      refuse(
        'www: refused: a decision needs its reason.',
        buildRunSpec(found.args).addFlag('why', runPlaceholders.reason).toArgv(),
      ),
    )
    .with({ kind: 'bad-decision-who' }, (found) =>
      refuse(
        'www: refused: --who on a decision is owner or agent.',
        buildRunSpec(found.args)
          .replaceFlag('who', toPlaceholder('<owner or agent>', 'who'))
          .toArgv(),
      ),
    )
    .with({ kind: 'no-such-decision' }, (found) => {
      const last =
        found.lastNumber === 0
          ? 'there are no decisions yet'
          : `the last is d-${String(found.lastNumber)}`;

      return refuse(
        `www: refused: there is no decision ${redactCredential(found.value)}; ${last}.`,
        ['log', '--op', 'decide,ruled-out'],
      );
    })
    .with({ kind: 'decision-numbers-used-up' }, (found) =>
      refuse(`www: refused: decision numbers are used up after d-${String(found.lastNumber)}.`, [
        'log',
        '--op',
        'decide,ruled-out',
      ]),
    )
    .with({ kind: 'decision-is-owners' }, (found) =>
      refuse(
        `www: refused: ${found.id} is the owner's decision, so only a decision recorded with --who owner replaces it.`,
        [
          'decide',
          toPlaceholder("<the owner's answer>"),
          '--why',
          runPlaceholders.reason,
          '--who',
          'owner',
          '--replaces',
          found.id,
        ],
      ),
    )
    .with({ kind: 'on-unknown' }, (found) => buildOnUnknown(found))
    .with(
      { kind: 'owner-only' },
      { kind: 'owner-notes-full' },
      { kind: 'owner-note-numbers-used-up' },
      { kind: 'owner-note-unknown' },
      (found) => buildOwnerRefusal(found),
    )
    .with({ kind: 'bad-since' }, (found) =>
      usage(2, 'www: --since takes 24h, 3d or day-7.', [found.command, '--since', '24h']),
    )
    .with({ kind: 'use-needs-for' }, (found) =>
      refuse(
        'www: refused: use needs what you did with it.',
        buildRunSpec(found.args).addFlag('for', runPlaceholders.what).toArgv(),
      ),
    )
    .with({ kind: 'use-not-approval' }, (found) => {
      const closes: RunWord[] =
        found.itemKind === 'lesson' || found.itemKind === 'words'
          ? ['drop', found.id, '--why', runPlaceholders.reason]
          : ['done', found.id, '--evidence', runPlaceholders.evidence];

      return refuse(
        `www: refused: ${found.id} is a ${getKindWord(found.itemKind)}, and use spends the one-time approval.`,
        closes,
      );
    })
    .with({ kind: 'no-open-item' }, (found) => buildNoOpenItem(found))
    .with({ kind: 'closed-id' }, (found) =>
      refuse(
        `www: refused: ${found.id} closed on day ${String(found.day)}. Pick a new id.`,
        buildRunSpec(found.args).replacePositional(0, runPlaceholders.newID).toArgv(),
      ),
    )
    .with(
      { kind: 'kind-full' },
      { kind: 'other-kind' },
      { kind: 'lesson-needs-why' },
      { kind: 'promise-needs-parts' },
      { kind: 'promise-separator' },
      { kind: 'words-needs-where' },
      { kind: 'close-kind' },
      { kind: 'id-held-twice' },
      (found) => buildKindRefusal(found),
    )
    .with({ kind: 'bad-id' }, (found) => {
      const repaired = repairID(found.id, 16, isItemID, runPlaceholders.newID);

      return refuse(
        'www: refused: an id is 2 to 16 characters of a-z, 0-9 and -, starts with a letter, and is not grant, d-<n> or o-<n>.',
        buildRunSpec(found.args).replacePositional(0, repaired).toArgv(),
      );
    })
    .with({ kind: 'too-many-checks' }, (found) =>
      refuse(
        'www: refused: an item takes one check. Split it into two items.',
        buildRunSpec(found.args).keepFirstCheck().toArgv(),
      ),
    )
    .with({ kind: 'malformed-check' }, { kind: 'check-not-one-line' }, (found) =>
      buildCheckValueRefusal(found),
    )
    .with({ kind: 'relative-path' }, (found) =>
      refuse(
        `www: refused: --${found.flag} takes an absolute path.`,
        buildRunSpec(found.args).replaceFlag(found.flag, found.absolute).toArgv(),
      ),
    )
    .with({ kind: 'rule-has-check' }, (found) =>
      refuse(
        'www: refused: a rule has no check. Make the checked thing a where item.',
        buildRunSpec(found.args)
          .renameCommand('where')
          .replacePositional(0, runPlaceholders.newID)
          .keepFirstCheck()
          .keepCheckAndNoteFlags()
          .toArgv(),
      ),
    )
    .with({ kind: 'blocked-by-unknown' }, (found) => buildBlockedByUnknown(found))
    .with({ kind: 'session-exists' }, (found) =>
      refuse(`www: refused: session ${found.name} exists. Bind this agent session to it.`, [
        'attach',
        found.name,
      ]),
    )
    .with({ kind: 'needs-goal' }, (found) =>
      refuse('www: refused: a session needs its goal.', [
        'init',
        found.args.positionals[0] ?? runPlaceholders.name,
        '--goal',
        runPlaceholders.goal,
      ]),
    )
    .with({ kind: 'bad-session-name' }, (found) =>
      refuse(
        'www: refused: a session name is 2 to 24 characters of a-z, 0-9 and -, and starts with a letter.',
        [
          'init',
          repairID(found.name, 24, isSessionName, runPlaceholders.name),
          '--goal',
          found.args.values.goal ?? runPlaceholders.goal,
        ],
      ),
    )
    .with({ kind: 'attach-no-session' }, (found) => buildAttachNoSession(found))
    .with({ kind: 'no-agent-id' }, (found) =>
      refuse(
        'www: refused: this shell has no agent session id (no CLAUDE_CODE_SESSION_ID or CODEX_SESSION_ID). Name the session on each command.',
        ['--session', found.name ?? runPlaceholders.name],
      ),
    )
    .with({ kind: 'detach-no-binding' }, (found) =>
      refuse(`www: refused: this ${formatHarness(found.harness)} session has no binding.`, [
        'sessions',
      ]),
    )
    .with({ kind: 'lock-busy' }, (found) => {
      const pid = found.pid === null ? 'unknown' : String(found.pid);

      return refuse(
        `www: refused: another write holds the lock on ${found.name} (pid ${pid}). Try again.`,
        buildRunSpec(found.args).toArgv(),
      );
    })
    .with({ kind: 'no-session' }, (found) => buildNoSession(found))
    .with({ kind: 'import-no-session' }, (found) =>
      refuse(
        `www: refused: no session folder ${found.name} to import. Sessions: ${formatList(found.sessions)}.`,
        ['sessions'],
      ),
    )
    .with({ kind: 'import-already-format-2' }, (found) =>
      found.hasAgent
        ? refuse(
            `www: refused: ${found.name} is already format 2. Bind this agent session to it.`,
            ['attach', found.name],
          )
        : refuse(`www: refused: ${found.name} is already format 2.`, ['--session', found.name]),
    )
    .with({ kind: 'upgrade-refused' }, (found) => buildUpgradeRefusal(found, buildRefusal))
    .with({ kind: 'hand-kept' }, (found): Refusal => ({
      exitCode: 5,
      lines: [`www: ${found.name} is a hand-kept store (format 0-by-hand). Convert it first.`],
      runs: [{ www: ['import', found.name] }],
    }))
    .with({ kind: 'format-1' }, (found): Refusal => ({
      exitCode: 5,
      lines: [
        `www: ${found.name} is format 1, and this www reads format 2. Upgrade it in place; the upgrade keeps a copy of each file it changes, and changes nothing when it refuses.`,
      ],
      runs: [{ www: ['import', found.name] }],
    }))
    .with({ kind: 'newer' }, (found): Refusal => ({
      exitCode: 5,
      lines: [`www: ${found.name} is format ${found.format}, and this www reads format 2.`],
      runs: [{ shell: ['bun', 'add', '-g', '@wherewerewe/cli@latest'] }],
    }))
    .with({ kind: 'broken-store' }, (found) => buildBrokenStore(found))
    .exhaustive();
}

function usage(exitCode: 2 | 4, line: string, argv: readonly RunWord[] = ['help']): Refusal {
  return { exitCode, lines: [line], runs: [{ www: argv }] };
}

type Found<Variant extends RefusalReason['kind']> = Extract<RefusalReason, { kind: Variant }>;

const grantLabels: ReadonlySet<string> = new Set(['bullet', "grant's scope", 'reading']);
const itemWriteCommands: ReadonlySet<string> = new Set(['task', 'wait', 'rule', 'where', 'set']);

function buildCredentialRun(found: Found<'credential'>): RunWord[] {
  if (found.target.label === 'note' || grantLabels.has(found.target.label)) {
    return replaceText(found.args, found.target, runPlaceholders.secret);
  }

  if (itemWriteCommands.has(found.args.command)) {
    const id = found.onOtherKind
      ? runPlaceholders.newID
      : (found.args.positionals[0] ?? runPlaceholders.newID);

    return buildRunSpec({ ...found.args, positionals: [] })
      .addPositional(id)
      .addPositional(runPlaceholders.secret)
      .renameCommand('where')
      .keepFlags(['note', 'owed'])
      .toArgv();
  }

  return replaceText(found.args, found.target, runPlaceholders.secret);
}

function buildOnUnknown(found: Found<'on-unknown'>): Refusal {
  const spec = buildRunSpec(found.args);
  const closest = pickClosestID(found.id, found.openIDs);

  return refuse(
    `www: refused: no open item ${redactCredential(found.id)}. Open items: ${formatList(found.openIDs)}.`,
    (closest === null ? spec.dropFlag('on') : spec.replaceFlag('on', closest)).toArgv(),
  );
}

function buildNoOpenItem(found: Found<'no-open-item'>): Refusal {
  const spec = buildRunSpec(found.args);
  const closest = pickClosestID(found.id, found.suggestIDs ?? found.openIDs);

  // A use with no approval left to spend has no id that fills the line, so it reads the id instead.
  const argv = match({ command: found.args.command, closest })
    .with({ command: 'set' }, () => buildTaskForSet(spec, found.args).toArgv())
    .with({ command: 'use', closest: null }, () => ['show', found.id])
    .otherwise(() =>
      spec.replacePositional(0, closest ?? toPlaceholder('<open id>', 'id')).toArgv(),
    );

  return refuse(
    `www: refused: no open item ${redactCredential(found.id)}. Open items: ${formatList(found.openIDs)}.`,
    argv,
  );
}

// A set with no claim changes only a note, so the task that makes the missing item takes a claim.
function buildTaskForSet(spec: RunSpec, args: ParsedArgs): RunSpec {
  const task = spec.renameCommand('task').keepCheckAndNoteFlags();

  return args.positionals.length === 1 ? task.addPositional(runPlaceholders.claim) : task;
}

// Lower-cases, turns each run of characters outside a-z, 0-9 and - into -, trims -, and cuts to
// the length. When the result still fails the rule, the placeholder stands in.
function repairID(
  typed: string,
  length: number,
  isValid: (candidate: string) => boolean,
  placeholder: Placeholder,
): RunWord {
  const repaired = typed
    .toLowerCase()
    .replaceAll(/[^a-z0-9-]+/gu, '-')
    .replaceAll(/^-+|-+$/gu, '')
    .slice(0, length)
    .replaceAll(/-+$/gu, '');

  return isValid(repaired) ? repaired : placeholder;
}

function buildBlockedByUnknown(found: Found<'blocked-by-unknown'>): Refusal {
  const spec = buildRunSpec(found.args);
  const closest = pickClosestID(found.blockedBy, found.openIDs);

  const argv =
    closest === null
      ? spec.dropFlag('blocked-by').toArgv()
      : spec.replaceFlag('blocked-by', closest).toArgv();

  return refuse(
    `www: refused: --blocked-by ${found.blockedBy} names no open task or wait. Open: ${formatList(found.openIDs)}.`,
    argv,
  );
}

function buildAttachNoSession(found: Found<'attach-no-session'>): Refusal {
  const closest = pickClosestID(found.name, found.sessions);
  const name = isSessionName(found.name) ? found.name : runPlaceholders.name;

  const argv: RunWord[] =
    closest === null ? ['init', name, '--goal', runPlaceholders.goal] : ['attach', closest];

  return refuse(
    `www: refused: no session ${found.name}. Sessions: ${formatList(found.sessions)}.`,
    argv,
  );
}

function formatHarness(harness: 'claude' | 'codex'): string {
  return match(harness)
    .with('claude', () => 'Claude Code')
    .with('codex', () => 'Codex')
    .exhaustive();
}

function buildNoSession(found: Found<'no-session'>): Refusal {
  const list = found.sessions
    .map((session) =>
      session.day === null ? session.name : `${session.name} (day ${String(session.day)})`,
    )
    .join(', ');

  const listed =
    found.sessions.length === 0
      ? 'There are no sessions on this machine yet.'
      : `Sessions on this machine: ${list}.`;

  const head =
    found.named === null
      ? 'www: no session for this agent.'
      : `www: no session ${found.named} on this machine.`;

  return {
    exitCode: 4,
    lines: [`${head} ${listed}`],
    runs: [
      { www: ['attach', runPlaceholders.name] },
      { www: ['init', runPlaceholders.name, '--goal', runPlaceholders.goal] },
    ],
  };
}

function buildBrokenStore(found: Found<'broken-store'>): Refusal {
  const where =
    found.line === null
      ? `${found.file} does not parse: ${found.reason}. Fix the file by hand.`
      : `${found.file} line ${String(found.line)} does not parse: ${found.reason}. Fix the row by hand.`;

  return {
    exitCode: 3,
    lines: [`www: ${found.name}'s ${where}`],
    runs: [{ shell: ['less', found.path] }],
  };
}
