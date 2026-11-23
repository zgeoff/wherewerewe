import { expect, test } from 'bun:test';

function setupTest() {
  const cliPath = new URL('cli.ts', import.meta.url).pathname;

  return {
    runCli: async (args: string[]) => {
      const child = Bun.spawn(['bun', cliPath, ...args], { stdout: 'pipe', stderr: 'pipe' });

      const [stdout, stderr, code] = await Promise.all([
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
        child.exited,
      ]);

      return { code, stdout, stderr };
    },
  };
}

test.each([['help'], ['--help']])('it prints the help and exits 0 for %s', async (arg) => {
  const ctx = setupTest();

  const result = await ctx.runCli([arg]);

  expect(result).toStrictEqual({
    code: 0,
    stdout: expect.stringContaining('Usage:'),
    stderr: '',
  });
});

test('it prints the help on stderr and exits 1 for an unknown command', async () => {
  const ctx = setupTest();

  const result = await ctx.runCli(['frobnicate']);

  expect(result).toStrictEqual({
    code: 1,
    stdout: '',
    stderr: expect.stringContaining("unknown command 'frobnicate'"),
  });
});
