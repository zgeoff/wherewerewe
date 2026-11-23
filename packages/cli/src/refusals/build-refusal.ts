import { match } from 'ts-pattern';
import { getKindWord } from '../rules/get-kind-word.ts';
import { isItemID } from '../rules/is-item-id.ts';
import { isSessionName } from '../rules/is-session-name.ts';
import { noSecretPlaceholder, redactCredential } from '../rules/redact-credential.ts';
import type { CheckFlag, ParsedArgs, Refusal, RefusalReason, TextTarget } from '../types.ts';
import { buildRunSpec } from './build-run-spec.ts';
import type { RunSpec } from './build-run-spec.ts';
import { pickClosestID } from './pick-closest-id.ts';
import { quoteShellWord } from './quote-shell-word.ts';

const evidencePlaceholder = '<PR, commit or test run>';
const goalPlaceholder = '<what done means>';

// Every refusal text and its Run lines live here, so each has one place to read and to test.
export function buildRefusal(reason: RefusalReason): Refusal {
  return match(reason)
    .with({ kind: 'no-store-folder' }, () =>
      usage(4, 'www: no store folder: set XDG_STATE_HOME or HOME.'),
    )
    .with({ kind: 'unknown-command' }, (found) =>
      usage(2, `www: unknown command "${found.command}".`),
    )
    .with({ kind: 'later-command' }, (found) =>
      usage(2, `www: "${found.command}" comes in a later version of www.`),
    )
    .with({ kind: 'unknown-flag' }, (found) => usage(2, `www: unknown flag "${found.flag}".`))
    .with({ kind: 'flag-needs-value' }, (found) => usage(2, `www: --${found.flag} needs a value.`))
    .with({ kind: 'flag-takes-no-value' }, (found) =>
      usage(2, `www: --${found.flag} takes no value.`),
    )
    .with({ kind: 'flag-not-taken' }, (found) =>
      usage(2, `www: ${found.command} takes no --${found.flag} flag.`),
    )
    .with({ kind: 'wrong-positionals' }, (found) =>
      usage(2, `www: ${found.command} takes ${found.usage}.`),
    )
    .with({ kind: 'text-too-long' }, (found) => buildTooLong(found))
    .with({ kind: 'text-not-one-line' }, (found) =>
      refuse(
        'www: refused: the text must be one line, with no tab or newline.',
        replaceText(found.args, found.target, '<one line>'),
      ),
    )
    .with({ kind: 'check-not-one-line' }, (found) =>
      refuse(
        'www: refused: the text must be one line, with no tab or newline.',
        buildRunSpec(found.args).replaceFlag(found.flag, '<one line>').toArgv(),
      ),
    )
    .with({ kind: 'text-empty' }, (found) =>
      refuse(
        `www: refused: the ${found.target.label} is empty.`,
        replaceText(found.args, found.target, `<${found.target.label}>`),
      ),
    )
    .with({ kind: 'credential' }, (found) =>
      refuse(
        `www: refused: the text looks like a credential (it matches ${found.label}). Write where the secret lives, never its value.`,
        buildCredentialRun(found),
      ),
    )
    .with({ kind: 'kind-full' }, (found) => buildKindFull(found))
    .with({ kind: 'needs-evidence' }, (found) =>
      refuse(
        'www: refused: done needs evidence a reader can open, such as a PR, a commit or a test run. For work you stopped, use drop.',
        buildRunSpec(found.args).addFlag('evidence', evidencePlaceholder).toArgv(),
      ),
    )
    .with({ kind: 'needs-reason' }, (found) =>
      refuse(
        'www: refused: drop needs a reason.',
        buildRunSpec(found.args).addFlag('why', '<reason>').toArgv(),
      ),
    )
    .with({ kind: 'needs-who' }, (found) =>
      refuse(
        'www: refused: a wait names who it waits on.',
        buildRunSpec(found.args).addFlag('who', '<who>').toArgv(),
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
    .with({ kind: 'ok-needs-parts' }, (found) => buildOkNeedsParts(found))
    .with({ kind: 'decide-needs-why' }, (found) =>
      refuse(
        'www: refused: a decision needs its reason.',
        buildRunSpec(found.args).addFlag('why', '<reason>').toArgv(),
      ),
    )
    .with({ kind: 'bad-decision-who' }, (found) =>
      refuse(
        'www: refused: --who on a decision is owner or agent.',
        buildRunSpec(found.args).replaceFlag('who', '<owner or agent>').toArgv(),
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
        `www: refused: ${found.id} is the owner's decision. Ask the owner, and record the answer with --who owner.`,
        [
          'decide',
          "<the owner's answer>",
          '--why',
          '<reason>',
          '--who',
          'owner',
          '--replaces',
          found.id,
        ],
      ),
    )
    .with({ kind: 'on-unknown' }, (found) => buildOnUnknown(found))
    .with({ kind: 'bad-since' }, () =>
      usage(2, 'www: --since takes 24h, 3d or day-7.', ['log', '--since', '24h']),
    )
    .with({ kind: 'use-needs-for' }, (found) =>
      refuse(
        'www: refused: use needs what you did with it.',
        buildRunSpec(found.args).addFlag('for', '<what you did with it>').toArgv(),
      ),
    )
    .with({ kind: 'use-standing' }, (found) =>
      refuse(
        `www: refused: ${found.id} is standing, so there is nothing to spend. Act inside its quote and scope.`,
        ['show', found.id],
      ),
    )
    .with({ kind: 'use-not-approval' }, (found) =>
      refuse(
        `www: refused: ${found.id} is a ${getKindWord(found.itemKind)}, and use spends a --once approval.`,
        ['done', found.id, '--evidence', evidencePlaceholder],
      ),
    )
    .with({ kind: 'no-open-item' }, (found) => buildNoOpenItem(found))
    .with({ kind: 'closed-id' }, (found) =>
      refuse(
        `www: refused: ${found.id} closed on day ${String(found.day)}. Pick a new id.`,
        buildRunSpec(found.args).replacePositional(0, '<new id>').toArgv(),
      ),
    )
    .with({ kind: 'other-kind' }, (found) =>
      refuse(
        `www: refused: ${found.id} is a ${getKindWord(found.itemKind)}. Change its text with set, or pick a new id.`,
        buildOtherKindRun(found),
      ),
    )
    .with({ kind: 'bad-id' }, (found) => {
      const repaired = repairID(found.id, 16, isItemID, '<new id>');

      return refuse(
        'www: refused: an id is 2 to 16 characters of a-z, 0-9 and -, starts with a letter, and is not d-<n> or o-<n>.',
        buildRunSpec(found.args).replacePositional(0, repaired).toArgv(),
      );
    })
    .with({ kind: 'too-many-checks' }, (found) =>
      refuse(
        'www: refused: an item takes one check. Split it into two items.',
        buildRunSpec(found.args).keepFirstCheck().toArgv(),
      ),
    )
    .with({ kind: 'malformed-check' }, (found) => buildMalformedCheck(found.args, found.flag))
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
          .replacePositional(0, '<new id>')
          .keepFirstCheck()
          .keepCheckFlags()
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
        found.args.positionals[0] ?? '<name>',
        '--goal',
        goalPlaceholder,
      ]),
    )
    .with({ kind: 'bad-session-name' }, (found) =>
      refuse(
        'www: refused: a session name is 2 to 24 characters of a-z, 0-9 and -, and starts with a letter.',
        [
          'init',
          repairID(found.name, 24, isSessionName, '<name>'),
          '--goal',
          found.args.values.goal ?? goalPlaceholder,
        ],
      ),
    )
    .with({ kind: 'attach-no-session' }, (found) => buildAttachNoSession(found))
    .with({ kind: 'no-agent-id' }, (found) =>
      refuse(
        'www: refused: this shell has no agent session id (no CLAUDE_CODE_SESSION_ID or CODEX_SESSION_ID). Name the session on each command.',
        ['--session', found.name ?? '<name>'],
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
    .with({ kind: 'hand-kept' }, (found): Refusal => ({
      exitCode: 5,
      lines: [`www: ${found.name} is a hand-kept store (format 0-by-hand). Convert it first.`],
      runs: [{ www: ['import', found.name] }],
    }))
    .with({ kind: 'newer' }, (found): Refusal => ({
      exitCode: 5,
      lines: [`www: ${found.name} is format ${found.format}, and this www reads format 1.`],
      runs: [{ shell: 'bun add -g @wherewerewe/cli@latest' }],
    }))
    .with({ kind: 'broken-store' }, (found) => buildBrokenStore(found))
    .exhaustive();
}

function usage(exitCode: 2 | 4, line: string, argv: readonly string[] = ['help']): Refusal {
  return { exitCode, lines: [line], runs: [{ www: argv }] };
}

type Found<Variant extends RefusalReason['kind']> = Extract<RefusalReason, { kind: Variant }>;

function buildTooLong(found: Found<'text-too-long'>): Refusal {
  const placeholder = `<${found.target.label} of at most ${String(found.limit)} characters>`;

  return refuse(
    `www: refused: the ${found.target.label} is ${String(found.length)} characters, and the limit is ${String(found.limit)}. Write what is true now; the story belongs in a PR or a commit.`,
    replaceText(found.args, found.target, placeholder),
  );
}

function refuse(line: string, argv: readonly string[]): Refusal {
  return { exitCode: 3, lines: [line], runs: [{ www: argv }] };
}

function replaceText(args: ParsedArgs, target: TextTarget, value: string): string[] {
  const spec: RunSpec = buildRunSpec(args);

  return 'positional' in target.place
    ? spec.replacePositional(target.place.positional, value).toArgv()
    : spec.replaceFlag(target.place.flag, value).toArgv();
}

const itemWriteCommands: ReadonlySet<string> = new Set(['task', 'wait', 'rule', 'where', 'set']);

function buildCredentialRun(found: Found<'credential'>): string[] {
  if (itemWriteCommands.has(found.args.command)) {
    const id = found.onOtherKind ? '<new id>' : (found.args.positionals[0] ?? '<new id>');

    return ['where', id, '<where the secret lives>'];
  }

  return replaceText(found.args, found.target, noSecretPlaceholder);
}

const capWords = {
  ok: { cap: 3, plural: 'approvals' },
  task: { cap: 6, plural: 'tasks' },
  wait: { cap: 4, plural: 'waits' },
  rule: { cap: 5, plural: 'rules' },
  where: { cap: 4, plural: 'where items' },
} as const;

function buildKindFull(found: Found<'kind-full'>): Refusal {
  const cap = capWords[found.itemKind].cap;
  const plural = capWords[found.itemKind].plural;

  const argv = match(found.itemKind)
    .with('rule', 'ok', () => ['drop', found.oldestID, '--why', '<reason>'])
    .with('task', 'wait', 'where', () => [
      'done',
      found.oldestID,
      '--evidence',
      evidencePlaceholder,
    ])
    .exhaustive();

  return refuse(
    `www: refused: the brief holds ${String(cap)} of ${String(cap)} ${plural}. Close one, or replace one with www set.`,
    argv,
  );
}

const approvalPlaceholders = {
  quote: '<their exact words>',
  who: '<who>',
  where: '<where>',
  scope: '<what it covers>',
} as const;

function buildOkNeedsParts(found: Found<'ok-needs-parts'>): Refusal {
  const base = found.needsUse
    ? buildRunSpec(found.args).dropFlag('once').dropFlag('standing')
    : buildRunSpec(found.args);

  const added = found.missing.reduce(
    (spec, flag) => spec.addFlag(flag, approvalPlaceholders[flag]),
    base,
  );

  return refuse(
    "www: refused: an approval needs the owner's exact words, who gave them, where, what they cover, and --once or --standing.",
    (found.needsUse ? added.addWord('<--once or --standing>') : added).toArgv(),
  );
}

function buildOnUnknown(found: Found<'on-unknown'>): Refusal {
  const spec = buildRunSpec(found.args);
  const closest = pickClosestID(found.id, found.openIDs);

  return refuse(
    `www: refused: no open item ${redactCredential(found.id)}. Open items: ${formatList(found.openIDs)}.`,
    (closest === null ? spec.dropFlag('on') : spec.replaceFlag('on', closest)).toArgv(),
  );
}

function formatList(words: readonly string[]): string {
  return words.length === 0 ? 'none' : words.join(', ');
}

function buildNoOpenItem(found: Found<'no-open-item'>): Refusal {
  const spec = buildRunSpec(found.args);
  const closest = pickClosestID(found.id, found.suggestIDs ?? found.openIDs);

  // A use with no approval left to spend has no id that fills the line, so it reads the id instead.
  const argv = match({ command: found.args.command, closest })
    .with({ command: 'set' }, () => spec.renameCommand('task').keepCheckFlags().toArgv())
    .with({ command: 'use', closest: null }, () => ['show', found.id])
    .otherwise(() => spec.replacePositional(0, closest ?? '<open id>').toArgv());

  return refuse(
    `www: refused: no open item ${redactCredential(found.id)}. Open items: ${formatList(found.openIDs)}.`,
    argv,
  );
}

// A rule has no check, so the set that turns the claim into a rule's new text drops the flags.
function buildOtherKindRun(found: Found<'other-kind'>): string[] {
  const typed = buildRunSpec(found.args);

  // ok takes its words in --quote, so the set that replaces it takes them as the claim
  const spec = (
    found.args.command === 'ok'
      ? typed.keepFlags([]).addPositional(found.args.values.quote ?? '<claim>')
      : typed
  ).renameCommand('set');

  return match(found.itemKind)
    .with('rule', () => spec.keepFlags([]).toArgv())
    .with('task', 'wait', 'ok', 'where', () => spec.keepCheckFlags().toArgv())
    .exhaustive();
}

// Lower-cases, turns each run of characters outside a-z, 0-9 and - into -, trims -, and cuts to
// the length. When the result still fails the rule, the placeholder stands in.
function repairID(
  typed: string,
  length: number,
  isValid: (candidate: string) => boolean,
  placeholder: string,
): string {
  const repaired = typed
    .toLowerCase()
    .replaceAll(/[^a-z0-9-]+/gu, '-')
    .replaceAll(/^-+|-+$/gu, '')
    .slice(0, length)
    .replaceAll(/-+$/gu, '');

  return isValid(repaired) ? repaired : placeholder;
}

function buildMalformedCheck(args: ParsedArgs, flag: CheckFlag): Refusal {
  const spec = buildRunSpec(args);

  return match(flag)
    .with('pr', () =>
      refuse(
        'www: refused: --pr takes <owner>/<repo>#<number>, such as bosunhq/bosun-api#77.',
        spec.replaceFlag('pr', '<owner>/<repo>#<number>').toArgv(),
      ),
    )
    .with('branch', () =>
      refuse(
        'www: refused: --branch takes <absolute repo path>@<branch>, such as /home/sam/src/bosun-api@tz-fix.',
        spec.replaceFlag('branch', '<absolute repo path>@<branch>').toArgv(),
      ),
    )
    .with('pid', () =>
      refuse(
        'www: refused: --pid takes a process id, such as 48211.',
        spec.replaceFlag('pid', '<process id>').toArgv(),
      ),
    )
    .with('path', () =>
      refuse(
        'www: refused: --path takes an absolute path.',
        spec.replaceFlag('path', '<absolute path>').toArgv(),
      ),
    )
    .exhaustive();
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
  const name = isSessionName(found.name) ? found.name : '<name>';
  const argv = closest === null ? ['init', name, '--goal', goalPlaceholder] : ['attach', closest];

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
    runs: [{ www: ['attach', '<name>'] }, { www: ['init', '<name>', '--goal', goalPlaceholder] }],
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
    runs: [{ shell: `less ${quoteShellWord(found.path)}` }],
  };
}
