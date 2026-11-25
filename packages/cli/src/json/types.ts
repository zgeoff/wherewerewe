import type {
  Item,
  JournalRow,
  Kind,
  LessonRow,
  Note,
  PromiseRow,
  PullRequestRow,
  WordsRow,
} from '../types.ts';

// The --json output of each read command, as lists-and-json.md gives the types. Text stays the
// default.

// a grant has at least one bullet in may, not or never
export interface GrantOpts {
  readonly may?: readonly string[];
  readonly not?: readonly string[];
  readonly never?: readonly string[];
  readonly scope?: string;
  readonly where: string;
  readonly reading: string;
}

export type Shown =
  | { readonly kind: Kind; readonly row: Item; readonly note: Note | null }
  | { readonly kind: 'lesson'; readonly row: LessonRow; readonly note: null }
  | { readonly kind: 'promise'; readonly row: PromiseRow; readonly note: null }
  | { readonly kind: 'words'; readonly row: WordsRow; readonly note: null };

export interface BriefJson {
  // oxlint-disable-next-line id-length -- the wire format names this key v
  readonly v: 1;
  readonly session: string;
  readonly day: number;
  readonly host: 'claude' | 'codex' | 'none';
  readonly limit: { readonly bytes: number; readonly tokens: number };
  readonly estimate: number;
  readonly goal: string;
  readonly grant: GrantOpts | null;
  readonly ownerNotes: readonly {
    readonly id: string;
    readonly text: string;
    readonly said: string;
    readonly on: string | null;
  }[];
  readonly words: readonly WordsRow[];
  readonly changed: readonly { readonly id: string; readonly was: string; readonly now: string }[];
  readonly focus: string | null;
  readonly next: string | null;
  readonly open: readonly Shown[];
  readonly lessons: readonly LessonRow[];
  readonly promises: readonly PromiseRow[];
  readonly decisions: readonly JournalRow[];
  readonly prs: readonly PullRequestRow[];
}

type ShowSubject =
  | (Shown & {
      readonly checkedNow: string | null;
      readonly failingChecks: readonly string[];
      readonly decisions: readonly string[];
    })
  | { readonly kind: 'grant'; readonly row: GrantOpts | null }
  | { readonly kind: 'decision'; readonly row: JournalRow };

export interface ShowJson {
  // oxlint-disable-next-line id-length -- the wire format names this key v
  readonly v: 1;
  readonly subjects: readonly (ShowSubject & { readonly journal: readonly JournalRow[] | null })[];
}

export interface LogJson {
  // oxlint-disable-next-line id-length -- the wire format names this key v
  readonly v: 1;
  readonly rows: readonly JournalRow[];
}

// oxlint-disable-next-line id-length -- the wire format names this key v
export type ListJson = { readonly v: 1 } & (
  | { readonly kind: 'decisions'; readonly rows: readonly JournalRow[] }
  | { readonly kind: 'prs'; readonly rows: readonly PullRequestRow[] }
  | { readonly kind: 'notes'; readonly rows: readonly Note[] }
  | {
      readonly kind:
        | 'tasks'
        | 'waits'
        | 'approvals'
        | 'rules'
        | 'where'
        | 'lessons'
        | 'promises'
        | 'words';
      readonly rows: readonly Shown[];
    }
);

export interface RecapJson {
  // oxlint-disable-next-line id-length -- the wire format names this key v
  readonly v: 1;
  readonly session: string;
  readonly day: number;
  readonly since: string;
  readonly writes: number | null;
  readonly grant: GrantOpts | null;
  readonly promises: readonly PromiseRow[];
  readonly notes: readonly { readonly item: Shown; readonly note: Note }[];
  readonly otherOpen: readonly string[];
  readonly decidedSince: readonly JournalRow[] | null;
  readonly closedSince: readonly JournalRow[] | null;
}
