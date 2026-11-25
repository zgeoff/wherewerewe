// One row of a session's notes. Every row has this shape, whatever its label.
export interface Row {
  readonly id: string;
  readonly label: string;
  readonly text: string;
  readonly note?: string;
  readonly who?: string;
  readonly by: string;
  readonly at: string;
  readonly closed?: Closed;
}

interface Closed {
  readonly at: string;
  readonly how: 'done' | 'dropped';
  readonly evidence?: string;
}

export interface Rows {
  // the latest version of each row, in the order each id first appeared
  readonly rows: readonly Row[];

  // every line of the file that parsed, oldest first
  readonly lines: readonly Row[];

  // lines the tool could not read, which it skips
  readonly unreadable: number;
}

export type Env = Readonly<Record<string, string | undefined>>;

export type Harness = 'claude' | 'codex';

export interface AgentID {
  readonly harness: Harness;
  readonly id: string;
}

// What a run of the CLI gives back to its caller.
export interface Result {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
}

export interface Context {
  readonly argv: readonly string[];
  readonly env: Env;
  readonly now: () => number;
  readonly stdin: string;

  // the path of the binary that is running, for the hook entries install writes
  readonly binaryPath: string;
  readonly version: string;
}

export interface Args {
  readonly words: readonly string[];
  readonly values: Readonly<Record<string, string>>;
  readonly switches: ReadonlySet<string>;
}

// What a command prints: a JSON value, or its plain form with --human.
export interface Reply {
  readonly json: unknown;
  readonly human: string;
}
