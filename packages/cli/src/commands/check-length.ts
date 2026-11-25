import { RefusalError } from '../refusal-error.ts';

export function checkLength(
  text: string | undefined,
  limit: number,
  name: string,
  run: string,
): void {
  if (text !== undefined && text.length > limit) {
    throw new RefusalError(
      `the ${name} is ${text.length} characters, and a ${name} holds at most ${limit}; split it into rows, or put the rest in a note or a file`,
      run,
    );
  }
}
