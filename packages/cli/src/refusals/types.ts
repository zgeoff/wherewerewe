import type { UpgradeProblem } from '../import/types.ts';
import type { CheckFlag, FileKind, Kind, ParsedArgs, TextTarget } from '../types.ts';

export type RefusalReason =
  | { readonly kind: 'no-store-folder' }
  | { readonly kind: 'unknown-command'; readonly command: string }
  | { readonly kind: 'flag-needs-value'; readonly flag: string }
  | {
      readonly kind: 'flag-value-has-dash';
      readonly flag: string;

      // the command as typed, with each dash value joined to its flag by =
      readonly argv: readonly string[];
    }
  | { readonly kind: 'flag-takes-no-value'; readonly flag: string }
  | {
      readonly kind: 'flag-not-taken';
      readonly command: string;

      // the flag as typed, with its dashes, such as --on or -z
      readonly flag: string;

      // the flags the command takes, and its help line after `www`, empty for the brief
      readonly taken: readonly string[];
      readonly line: string;
    }
  | { readonly kind: 'goal-paste-with-text' }
  | { readonly kind: 'no-grant-to-print'; readonly name: string }
  | {
      readonly kind: 'wrong-positionals';
      readonly command: string;
      readonly usage: string;

      // the command's help line after `www`
      readonly line: string;
    }
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
      readonly itemKind: 'task' | 'wait' | 'rule' | 'where' | 'ok' | FileKind;
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
  | {
      readonly kind: 'grant-too-many-bullets';
      readonly args: ParsedArgs;
      readonly count: number;
    }
  | {
      readonly kind: 'grant-too-many-lines';
      readonly args: ParsedArgs;
      readonly lines: number;
    }
  | {
      readonly kind: 'text-has-mark';
      readonly args: ParsedArgs;
      readonly target: TextTarget;
      readonly text: string;
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
  | { readonly kind: 'bad-since'; readonly args: ParsedArgs }
  | { readonly kind: 'use-needs-for'; readonly args: ParsedArgs }
  | {
      readonly kind: 'use-not-approval';
      readonly id: string;
      readonly itemKind: Kind | FileKind;
    }
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
      readonly itemKind: Kind | FileKind;
    }
  | { readonly kind: 'bad-list-kind' }
  | { readonly kind: 'lesson-needs-why'; readonly args: ParsedArgs }
  | {
      readonly kind: 'promise-needs-parts';
      readonly args: ParsedArgs;
      readonly missing: readonly ('to' | 'by')[];
    }
  | {
      readonly kind: 'promise-separator';
      readonly args: ParsedArgs;
      readonly flag: 'to' | 'by';
      readonly value: string;
    }
  | { readonly kind: 'words-needs-where'; readonly args: ParsedArgs }
  | { readonly kind: 'close-kind'; readonly id: string; readonly itemKind: 'lesson' | 'words' }
  | {
      // an id that two files hold open, as the tool of an earlier version can leave
      readonly kind: 'id-held-twice';
      readonly name: string;
      readonly id: string;
      readonly first: string;
      readonly second: string;
      readonly path: string;
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
