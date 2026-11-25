// A refusal: what went wrong, and the command that puts it right.
export class RefusalError extends Error {
  readonly run: string;

  readonly exitCode: number;

  constructor(message: string, run: string, exitCode = 2) {
    super(message);

    this.name = 'RefusalError';
    this.run = run;
    this.exitCode = exitCode;
  }
}
