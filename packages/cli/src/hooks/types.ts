export type Harness = 'claude' | 'codex';

// What a hook reads of its stdin, one member per event, from one parser per harness.
export type HookInput =
  | {
      readonly event: 'SessionStart';
      readonly harness: Harness;
      readonly sessionID: string;
      readonly source: string | null;
    }
  | {
      readonly event: 'PreToolUse';
      readonly harness: Harness;
      readonly sessionID: string;
      readonly agentID: string | null;
      readonly toolName: string;
      readonly command: string | null;
    }
  | {
      readonly event: 'PostToolUse';
      readonly harness: Harness;
      readonly sessionID: string;
      readonly agentID: string | null;
      readonly toolName: string;
      readonly command: string;
      readonly response: string;
      readonly exitCode: number | null;
      readonly maxOutputTokens: number | null;
    }
  | {
      readonly event: 'PostToolUseFailure';
      readonly harness: 'claude';
      readonly sessionID: string;
      readonly agentID: string | null;
      readonly toolName: string;
      readonly command: string;
    }
  | { readonly event: 'SubagentStart'; readonly harness: Harness; readonly sessionID: string }
  | {
      readonly event: 'Stop';
      readonly harness: Harness;
      readonly sessionID: string;
      readonly agentID: string | null;
      readonly stopHookActive: boolean;
    };

export type GateState = 'wiped' | 'reading' | 'cut' | 'failed' | 'read' | 'open';

export interface GateFile {
  readonly state: GateState;
  readonly session: string;
  readonly reads: number;
  readonly spare: 0 | 1;
}

// One event of the gate, after the hook sorted its payload.
export type GateEvent =
  | { readonly kind: 'session-start' }
  | { readonly kind: 'call'; readonly call: 'brief-command' | 'www-command' | 'other-call' }
  | { readonly kind: 'end'; readonly end: 'whole' | 'cut' | 'failed' }
  | { readonly kind: 'stop'; readonly stopHookActive: boolean };

// What the hook prints for the event, before the harness shapes it.
export type GateOutput =
  | { readonly kind: 'none' }
  | { readonly kind: 'pass' }

  // the fail-open line, as additionalContext
  | { readonly kind: 'pass-with-line' }
  | { readonly kind: 'refuse'; readonly reason: 'standard' | 'cut' }

  // Stop, with the standard reason
  | { readonly kind: 'block' }

  // SessionStart: GOAL, GRANT and the two lines
  | { readonly kind: 'inject' };

export interface GateStep {
  // null: write nothing
  readonly file: GateFile | null;
  readonly output: GateOutput;
}

export type GateColumn =
  | 'session-start'
  | 'brief-command'
  | 'other-call'
  | 'whole'
  | 'cut'
  | 'failed'
  | 'stop';

export type GateCell =
  | {
      readonly kind: 'go';
      readonly next: GateState | 'same';
      readonly output: GateOutput['kind'];
      readonly reason?: 'standard' | 'cut';
    }

  // reading x cut, reading x failed
  | { readonly kind: 'when-reads-zero'; readonly next: 'cut' | 'failed' }

  // cut x other call
  | { readonly kind: 'by-spare'; readonly spare1: GateCell; readonly spare0: GateCell }

  // wiped x Stop
  | { readonly kind: 'by-stop-active'; readonly inactive: GateCell; readonly active: GateCell };
