export interface Gate {
  readonly state: 'wiped' | 'read';
  readonly refusals: number;
}

export interface Payload {
  readonly event: string;
  readonly sessionID: string;
  readonly isSubagent: boolean;
  readonly command: string | null;
}
