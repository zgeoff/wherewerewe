export type Kind = 'task' | 'wait' | 'ok' | 'rule' | 'where';

// The kinds a session holds beside the items of items.tsv, each in a file of its own.
export type FileKind = 'lesson' | 'promise' | 'words';

// The file that holds a row: items.tsv, or the file of one of the three kinds.
export type RowFile = 'items' | FileKind;

export interface LastJournalRow {
  readonly op: string;
  readonly text: string | null;
}

type Author = 'agent' | 'owner' | 'import';

// pr:<owner>/<repo>#<n> | branch:<absolute path>@<branch> | path:<absolute path> | pid:<n>
export type CheckRef = string;

export interface Extra {
  readonly who?: string;
  readonly where?: string;
  readonly scope?: string;
  readonly blocked_by?: string;
  readonly pid_start?: string;
}

export interface Item {
  readonly id: string;
  readonly kind: Kind;
  readonly claim: string;

  // '-' on disk
  readonly check: CheckRef | null;

  // '-' on disk
  readonly atWrite: string | null;

  // '-' on disk
  readonly last: string | null;

  // ISO 8601 UTC to the second, with Z
  readonly written: string;
  readonly by: Author;

  // '-' on disk when empty
  readonly extra: Extra;
}

export interface Note {
  // an open item's id; at most one row per id
  readonly id: string;

  // 'owed' or '-' on disk
  readonly owed: boolean;

  // ISO 8601 UTC to the second, with Z
  readonly written: string;

  // 1 to 400 characters, one line
  readonly note: string;
}

// A grant has at least one bullet in may, not or never.
export interface Grant {
  // what the owner allows, one bullet each in the owner's words
  readonly may: readonly string[];

  // what the owner did not grant, one bullet each in the owner's words
  readonly not: readonly string[];

  // what the owner ruled out, one bullet each in the owner's words
  readonly never: readonly string[];

  // where the grant applies, in the owner's words, 1 to 40 characters; null when the owner gave none
  readonly scope: string | null;

  // the agent's reading of what the bullets cover and what the owner kept back, 1 to 200 characters
  readonly reading: string;

  // where the owner gave the words, 1 to 16 characters, no ';' or '='
  readonly where: string;

  // when the words were last written; a new reading alone keeps it
  readonly set: string;
}

export interface SessionFile {
  readonly format: '2';
  readonly name: string;
  readonly goal: string;

  // null when the session holds no grant: no bullet lines, and the other grant keys empty on disk
  readonly grant: Grant | null;
  readonly started: string;

  // empty value on disk
  readonly now: string | null;
  readonly nowNext: string | null;
  readonly nowSet: string | null;
  readonly lastWrite: string | null;
  readonly lastNudge: string | null;

  // the key is left out when null
  readonly importedFrom: string | null;
}

export interface JournalRow {
  readonly ts: string;
  readonly op: string;
  readonly id: string;
  readonly by: 'agent' | 'owner' | 'hook' | 'import';

  // '-' on disk
  readonly text: string | null;
  readonly why: string | null;

  // key=value pairs joined by ';'
  readonly extra: string | null;
}

// A pull request the session opened, as prs.tsv holds it.
export interface PullRequestRow {
  // <owner>/<repo>#<n>
  readonly ref: string;

  // ISO 8601 UTC to the second, with Z
  readonly opened: string;

  // '-' on disk before the first read
  readonly state: 'OPEN' | 'MERGED' | 'CLOSED' | null;

  // the time of that state; '-' on disk before the first read
  readonly seen: string | null;
}

export interface Store {
  // absolute path of the session folder
  readonly folder: string;
  readonly session: SessionFile;
  readonly items: readonly Item[];

  // the notes of open items, in file order
  readonly notes: readonly Note[];
  readonly ownerNotes: readonly OwnerNote[];

  // the rows of prs.tsv that parse, in file order
  readonly prs: readonly PullRequestRow[];

  // null when every row of notes.tsv parses
  readonly notesUnread: UnreadRows | null;

  // null when every row of owner.tsv parses
  readonly ownerUnread: UnreadRows | null;

  // null when every row of prs.tsv parses
  readonly prsUnread: UnreadRows | null;

  // the rows of lessons.tsv, promises.tsv and words.tsv that parse, in file order
  readonly lessons: readonly LessonRow[];
  readonly promises: readonly PromiseRow[];
  readonly words: readonly WordsRow[];

  // null when every row of that file parses
  readonly lessonsUnread: UnreadRows | null;
  readonly promisesUnread: UnreadRows | null;
  readonly wordsUnread: UnreadRows | null;
}

// An open lesson, as lessons.tsv holds it.
export interface LessonRow {
  readonly id: string;
  readonly text: string;
  readonly why: string;

  // ISO 8601 UTC to the second, with Z
  readonly written: string;
  readonly by: 'agent' | 'owner';
}

// An open promise, as promises.tsv holds it.
export interface PromiseRow {
  readonly id: string;
  readonly what: string;
  readonly to: string;
  readonly byWhen: string;
  readonly written: string;
  readonly by: 'agent' | 'owner';
}

// The owner's exact words, as words.tsv holds them.
export interface WordsRow {
  readonly id: string;
  readonly words: string;
  readonly where: string;
  readonly written: string;
  readonly by: 'agent' | 'owner';
}

export interface OwnerNote {
  // o-<n>
  readonly id: string;

  // 1 to 160 characters, one line
  readonly text: string;

  // ISO 8601 UTC to the second, with Z
  readonly said: string;

  // '-' on disk
  readonly on: string | null;
}

export interface OwnerChange {
  // the whole new owner.tsv, oldest first
  readonly notes: readonly OwnerNote[];
  readonly journal: readonly JournalRow[];
}

// What a write needs from the journal, from its ts, op and id columns only.
export interface JournalIndex {
  // id -> ts of its done, drop or use row
  readonly closed: ReadonlyMap<string, string>;

  // row file -> id -> the newest journal row of the id in that file. A lesson, promise or words
  // row, or a close whose kind= names one, is in that file; any other row is in items.tsv. The
  // journal's order is the identity of a close, which a replacing write cannot share (store.md).
  readonly lastRows: Readonly<Record<RowFile, ReadonlyMap<string, LastJournalRow>>>;

  // d-<n> -> its who=, from the extra of its decide or ruled-out row
  readonly decisions: ReadonlyMap<string, { readonly who: 'owner' | 'agent' | null }>;

  // 0 when there is no decision
  readonly lastDecisionNumber: number;

  // every decision id that a later decide row's replaces= names
  readonly replaced: ReadonlySet<string>;

  // the decide rows in force, newest first
  readonly inForce: readonly { readonly id: string; readonly choice: string }[];

  // the highest n of an o-<n> id on a say row, whoever wrote it; 0 when there is none
  readonly lastOwnerNoteNumber: number;
}

export interface UnreadRows {
  readonly file: string;
  readonly line: number | null;
  readonly reason: string;
}

export interface StoreChange {
  readonly session?: SessionFile;
  readonly items?: readonly Item[];

  // the whole new notes.tsv, rows in file order, a new row last
  readonly notes?: readonly Note[];

  // the whole new lessons.tsv, promises.tsv or words.tsv, a new row last
  readonly lessons?: readonly LessonRow[];
  readonly promises?: readonly PromiseRow[];
  readonly words?: readonly WordsRow[];
  readonly journal: readonly JournalRow[];
}

// A value only the agent knows, such as `<claim>`, which a Run line prints for the agent to fill.
// A Run word that is a string is a value, typed or read, and never a placeholder, whatever it
// looks like.
export interface Placeholder {
  readonly placeholder: string;

  // the rule its value meets beyond being one line of text, so a Run line's check fills it with a
  // sample that passes: an id or session name, a check flag's value, or a decision's who
  readonly shape?: PlaceholderShape;
}

export type PlaceholderShape = 'id' | 'path' | 'branch' | 'pr' | 'pid' | 'who';

export type RunWord = string | Placeholder;

// The Run line that upgrades this www: a shell command, or commands piped into each other.
export type UpgradeRun =
  | { readonly shell: readonly string[] }
  | { readonly pipeline: readonly (readonly string[])[] };

// A shell Run line holds the words of a command other than www, each quoted as it prints.
export type RunLine =
  | { readonly www: readonly RunWord[] }
  | UpgradeRun

  // a usage line: the text of a command's help line after `www`, printed as it stands
  | { readonly usage: string }

  // the line that upgrades this www, which the scope of the refusal picks by the channel the
  // binary came from
  | { readonly upgrade: true };

export interface Refusal {
  readonly exitCode: 2 | 3 | 4 | 5;

  // the first starts with "www: "
  readonly lines: readonly string[];

  // one or two
  readonly runs: readonly RunLine[];
}

export interface CLIInput {
  readonly argv: readonly string[];
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly cwd: string;

  // ms since the epoch
  readonly now: () => number;

  // whether file descriptors 0 and 1 are terminals, read once by cli.ts
  readonly terminal: { readonly stdin: boolean; readonly stdout: boolean };

  // the text of stdin, read by cli.ts for `hook` alone
  readonly stdin?: string | undefined;

  // prints text at once, which `install` uses to say what it will write before it writes; without
  // it that text comes first in the result's stdout
  readonly emit?: (text: string) => void;
  // the binary's own path and its real path, read once by cli.ts, which pick the channel that a
  // newer-store refusal tells the user to upgrade through; a path of neither Homebrew's gets the
  // install script
  readonly binaryPath?: { readonly execPath: string; readonly realPath: string };
}

export interface CLIResult {
  // 1 only for a hook's fault switch, which fails on purpose
  readonly exitCode: 0 | 1 | 2 | 3 | 4 | 5;
  readonly stdout: string;
  readonly stderr: string;
}

// What a command returns to runCLI: the result, and how its stdout is printed. A JSON stdout is one
// encoded line whose strings the command already redacted, so runCLI's word pass skips it.
export interface CommandResult extends CLIResult {
  readonly stdoutFormat: 'text' | 'json';
}

export interface AgentID {
  readonly harness: 'claude' | 'codex';
  readonly id: string;
}

export type CheckFlag = 'pr' | 'branch' | 'path' | 'pid';

export interface TypedFlag {
  readonly name: string;

  // null for a boolean flag
  readonly value: string | null;
}

interface ArgValues {
  readonly session?: string | undefined;
  readonly goal?: string | undefined;
  readonly who?: string | undefined;
  readonly where?: string | undefined;
  readonly scope?: string | undefined;
  readonly quote?: string | undefined;
  readonly may?: string[] | undefined;
  readonly not?: string[] | undefined;
  readonly never?: string[] | undefined;
  readonly reading?: string | undefined;
  readonly drop?: string[] | undefined;
  readonly why?: string | undefined;
  readonly on?: string | undefined;
  readonly replaces?: string | undefined;
  readonly evidence?: string | undefined;
  readonly for?: string | undefined;
  readonly 'blocked-by'?: string | undefined;
  readonly since?: string | undefined;
  readonly op?: string | undefined;
  readonly id?: string | undefined;
  readonly pr?: string[] | undefined;
  readonly branch?: string[] | undefined;
  readonly path?: string[] | undefined;
  readonly pid?: string[] | undefined;
  readonly once?: boolean | undefined;
  readonly standing?: boolean | undefined;
  readonly 'ruled-out'?: boolean | undefined;
  readonly note?: string | undefined;
  readonly owed?: boolean | undefined;
  readonly 'no-note'?: boolean | undefined;
  readonly to?: string | undefined;
  readonly by?: string | undefined;
  readonly json?: boolean | undefined;
  readonly paste?: boolean | undefined;
  readonly print?: boolean | undefined;
  readonly 'replace-skill'?: boolean | undefined;
  readonly version?: boolean | undefined;
  readonly help?: boolean | undefined;
}

export interface ParsedArgs {
  // the first positional, or 'brief' when there is none
  readonly command: string;

  // the words after the command
  readonly positionals: readonly string[];
  readonly values: ArgValues;
  readonly sessionFlag: string | null;

  // every flag but --session, in the order typed
  readonly flags: readonly TypedFlag[];
}

type TextLabel =
  | 'claim'
  | 'next step'
  | 'goal'
  | 'evidence'
  | 'reason'
  | 'who'
  | 'where'
  | 'scope'
  | 'quote'
  | 'bullet'
  | "grant's scope"
  | 'reading'
  | 'owner note'
  | 'decision'
  | '--for text'
  | 'note'
  | 'lesson'
  | 'why'
  | 'promise'
  | '--to'
  | '--by'
  | "owner's words";

// Where a text sits in the typed command.
export interface TextTarget {
  readonly label: TextLabel;

  // a flag that repeats, such as --may, names the value by its place among that flag's values
  readonly place:
    | { readonly positional: number }
    | { readonly flag: string }
    | { readonly flag: string; readonly occurrence: number };
}

export interface SessionSummary {
  readonly name: string;
  readonly format: string | null;
  readonly started: string | null;
  readonly lastWrite: string | null;
  readonly goal: string | null;
}

export type { RefusalReason } from './refusals/types.ts';
