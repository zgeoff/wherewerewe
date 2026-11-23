import { run } from '@zgeoff/testing/process';

// Splits shell text into words with a real POSIX shell, which prints each word to a pipe ended
// with a NUL. The text must hold only words, with no pipe, redirection or command inside it.
export async function readShellWords(text: string): Promise<readonly string[]> {
  const result = await run(['/bin/sh', '-c', `printf '%s\\0' ${text}`]);

  if (result.exitCode !== 0) {
    throw new Error(`the shell refused ${text}: ${result.stderr}`);
  }

  return result.stdout.split('\0').slice(0, -1);
}
