export type Kind = 'task' | 'wait' | 'ok' | 'rule' | 'where';

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

export interface Grant {
  // the owner's words, 1 to 700 characters, one line: www grant turns each line break into a space
  readonly words: string;

  // the agent's reading of what the words cover and what the owner kept back, 1 to 200 characters
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

  // null when the session holds no grant; the four grant keys are empty on disk
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

export interface Store {
  // absolute path of the session folder
  readonly folder: string;
  readonly session: SessionFile;
  readonly items: readonly Item[];

  // the notes of open items, in file order
  readonly notes: readonly Note[];
  readonly ownerNotes: readonly OwnerNote[];

  // null when every row of notes.tsv parses
  readonly notesUnread: UnreadRows | null;

  // null when every row of owner.tsv parses
  readonly ownerUnread: UnreadRows | null;
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

  // d-<n> -> its who=, from the extra of its decide or ruled-out row
  readonly decisions: ReadonlyMap<string, { readonly who: 'owner' | 'agent' | null }>;

  // 0 when there is no decision
  readonly lastDecisionNumber: number;

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
  readonly journal: readonly JournalRow[];
}

export type RunLine = { readonly www: readonly string[] } | { readonly shell: string };

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
}

export interface CLIResult {
  readonly exitCode: 0 | 2 | 3 | 4 | 5;
  readonly stdout: string;
  readonly stderr: string;
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
  | 'words'
  | 'reading'
  | 'owner note'
  | 'decision'
  | '--for text'
  | 'note';

// Where a text sits in the typed command.
export interface TextTarget {
  readonly label: TextLabel;
  readonly place: { readonly positional: number } | { readonly flag: string };
}

export interface SessionSummary {
  readonly name: string;
  readonly format: string | null;
  readonly started: string | null;
  readonly lastWrite: string | null;
  readonly goal: string | null;
}

export type RefusalReason =
  | { readonly kind: 'no-store-folder' }
  | { readonly kind: 'unknown-command'; readonly command: string }
  | { readonly kind: 'later-command'; readonly command: string }
  | { readonly kind: 'unknown-flag'; readonly flag: string }
  | { readonly kind: 'flag-needs-value'; readonly flag: string }
  | { readonly kind: 'flag-takes-no-value'; readonly flag: string }
  | { readonly kind: 'flag-not-taken'; readonly command: string; readonly flag: string }
  | { readonly kind: 'wrong-positionals'; readonly command: string; readonly usage: string }
  | {
      readonly kind: 'text-too-long';
      readonly args: ParsedArgs;
      readonly target: TextTarget;
      readonly length: number;
      readonly limit: number;
    }
  | { readonly kind: 'text-not-one-line'; readonly args: ParsedArgs; readonly target: TextTarget }
  | { readonly kind: 'text-empty'; readonly args: ParsedArgs; readonly target: TextTarget }
  | {
      readonly kind: 'credential';
      readonly args: ParsedArgs;
      readonly target: TextTarget;
      readonly label: string;
      readonly onOtherKind: boolean;
    }
  | {
      readonly kind: 'kind-full';
      readonly itemKind: 'task' | 'wait' | 'rule' | 'where' | 'ok';
      readonly oldestID: string;
    }
  | { readonly kind: 'owed-needs-note'; readonly args: ParsedArgs }
  | { readonly kind: 'note-and-no-note'; readonly args: ParsedArgs }
  | { readonly kind: 'set-needs-change'; readonly args: ParsedArgs }
  | { readonly kind: 'set-check-needs-claim'; readonly args: ParsedArgs }
  | { readonly kind: 'no-note-to-clear'; readonly args: ParsedArgs; readonly id: string }
  | {
      readonly kind: 'owed-note';
      readonly args: ParsedArgs;
      readonly id: string;
      readonly age: string;
      readonly note: string;
    }
  | { readonly kind: 'needs-evidence'; readonly args: ParsedArgs }
  | { readonly kind: 'needs-reason'; readonly args: ParsedArgs }
  | { readonly kind: 'needs-who'; readonly args: ParsedArgs }
  | {
      readonly kind: 'extra-has-separator';
      readonly args: ParsedArgs;
      readonly flag: 'who' | 'where' | 'scope';
      readonly value: string;
    }
  | {
      readonly kind: 'ok-needs-parts';
      readonly args: ParsedArgs;
      readonly missing: readonly ('quote' | 'who' | 'where' | 'scope')[];
    }
  | { readonly kind: 'ok-standing'; readonly args: ParsedArgs }
  | { readonly kind: 'grant-needs-part'; readonly args: ParsedArgs }
  | {
      readonly kind: 'grant-reading-no-grant';
      readonly args: ParsedArgs;
      readonly name: string;
    }
  | {
      readonly kind: 'grant-words-too-long';
      readonly args: ParsedArgs;
      readonly length: number;
    }
  | { readonly kind: 'decide-needs-why'; readonly args: ParsedArgs }
  | { readonly kind: 'bad-decision-who'; readonly args: ParsedArgs }
  | {
      readonly kind: 'no-such-decision';
      readonly value: string;

      // 0 when there is none
      readonly lastNumber: number;
    }
  | { readonly kind: 'decision-numbers-used-up'; readonly lastNumber: number }
  | { readonly kind: 'decision-is-owners'; readonly id: string }
  | {
      readonly kind: 'on-unknown';
      readonly args: ParsedArgs;
      readonly id: string;
      readonly openIDs: readonly string[];
    }
  | { readonly kind: 'owner-only' }
  | { readonly kind: 'owner-notes-full'; readonly name: string; readonly oldestID: string }
  | { readonly kind: 'owner-note-numbers-used-up'; readonly lastNumber: number }
  | {
      readonly kind: 'owner-note-unknown';
      readonly name: string;
      readonly id: string;
      readonly shownIDs: readonly string[];
    }
  | { readonly kind: 'bad-since' }
  | { readonly kind: 'use-needs-for'; readonly args: ParsedArgs }
  | { readonly kind: 'use-not-approval'; readonly id: string; readonly itemKind: Kind }
  | {
      readonly kind: 'no-open-item';
      readonly args: ParsedArgs;
      readonly id: string;
      readonly openIDs: readonly string[];

      // the open ids that the Run line may suggest, when fewer than openIDs would pass
      readonly suggestIDs?: readonly string[];
    }
  | {
      readonly kind: 'closed-id';
      readonly args: ParsedArgs;
      readonly id: string;
      readonly day: number;
    }
  | {
      readonly kind: 'other-kind';
      readonly args: ParsedArgs;
      readonly id: string;
      readonly itemKind: Kind;
    }
  | { readonly kind: 'bad-id'; readonly args: ParsedArgs; readonly id: string }
  | { readonly kind: 'too-many-checks'; readonly args: ParsedArgs; readonly firstFlag: CheckFlag }
  | { readonly kind: 'malformed-check'; readonly args: ParsedArgs; readonly flag: CheckFlag }
  | { readonly kind: 'check-not-one-line'; readonly args: ParsedArgs; readonly flag: CheckFlag }
  | {
      readonly kind: 'relative-path';
      readonly args: ParsedArgs;
      readonly flag: 'path' | 'branch';
      readonly absolute: string;
    }
  | { readonly kind: 'rule-has-check'; readonly args: ParsedArgs }
  | {
      readonly kind: 'blocked-by-unknown';
      readonly args: ParsedArgs;
      readonly blockedBy: string;
      readonly openIDs: readonly string[];
    }
  | { readonly kind: 'session-exists'; readonly name: string }
  | { readonly kind: 'needs-goal'; readonly args: ParsedArgs }
  | { readonly kind: 'bad-session-name'; readonly args: ParsedArgs; readonly name: string }
  | {
      readonly kind: 'attach-no-session';
      readonly name: string;
      readonly sessions: readonly string[];
    }
  | {
      readonly kind: 'no-agent-id';

      // the session the command named, or null when it named none
      readonly name: string | null;
    }
  | { readonly kind: 'detach-no-binding'; readonly harness: 'claude' | 'codex' }
  | {
      readonly kind: 'lock-busy';
      readonly args: ParsedArgs;
      readonly name: string;
      readonly pid: number | null;
    }
  | {
      readonly kind: 'no-session';
      readonly named: string | null;
      readonly sessions: readonly { readonly name: string; readonly day: number | null }[];
    }
  | {
      readonly kind: 'import-no-session';
      readonly name: string;
      readonly sessions: readonly string[];
    }
  | {
      readonly kind: 'import-already-format-2';
      readonly name: string;
      readonly hasAgent: boolean;
    }
  | {
      // The upgrade of a format 1 store, or the import of a hand-kept one, found a problem the
      // flags or the rows can fix. Each problem's lines come first, then one Run line.
      readonly kind: 'upgrade-refused';
      readonly args: ParsedArgs;
      readonly name: string;
      readonly rowProblems: readonly string[];
      readonly problems: readonly UpgradeProblem[];
    }
  | { readonly kind: 'hand-kept'; readonly name: string }
  | { readonly kind: 'format-1'; readonly name: string }
  | { readonly kind: 'newer'; readonly name: string; readonly format: string }
  | {
      readonly kind: 'broken-store';
      readonly name: string;
      readonly file: string;
      readonly path: string;
      readonly line: number | null;
      readonly reason: string;
    };

export interface ApprovalLine {
  readonly id: string;
  readonly quote: string;
  readonly scope: string;

  // ISO 8601 UTC to the second, with Z
  readonly written: string;

  // the age of a one-time approval, such as 5d; null for a standing one
  readonly age: string | null;
}

// What an upgrade or an import checks before it writes.
export type UpgradeProblem =
  | { readonly kind: 'needs-grant'; readonly approvals: readonly ApprovalLine[] }
  | { readonly kind: 'too-many-once'; readonly approvals: readonly ApprovalLine[] }
  | { readonly kind: 'grant-id' }
  | { readonly kind: 'grant-needs-part' }
  | { readonly kind: 'grant-text'; readonly reason: RefusalReason }
  | {
      readonly kind: 'drop-unknown';
      readonly id: string;
      readonly open: readonly string[];
    };
