export type FilePlan =
  | { readonly kind: 'refused'; readonly reason: 'unreadable' | 'foreign-rules' | 'foreign-skill' }
  | {
      readonly kind: 'text';
      readonly text: string;

      // printed before the write: what a rule adds to a file
      readonly notices: readonly string[];
      readonly changedLine: string;
      readonly sameLine: string;
    };

export const allowRule = 'Bash(www *)';
export const codexRuleLine = 'prefix_rule(pattern = ["www"], decision = "allow")';

export interface DoctorCheck {
  readonly isOk: boolean;

  // `ok: …` for a pass, otherwise the failing line and each fix, as printed
  readonly lines: readonly string[];
}
