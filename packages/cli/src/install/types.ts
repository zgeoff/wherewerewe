export type Json = Readonly<Record<string, unknown>>;

export interface Paths {
  readonly claudeSettings: string;
  readonly codexHooks: string;
  readonly codexRules: string;
  readonly codexConfig: string;
  readonly skills: readonly string[];
}

// One file install writes, or one thing doctor checks.
export interface Step {
  readonly path: string;
  readonly ok: boolean;
  readonly detail: string;
  readonly content?: string;
}
