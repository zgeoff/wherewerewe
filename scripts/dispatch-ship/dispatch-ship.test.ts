import { expect, test } from 'bun:test';
import { dispatchShip } from './dispatch-ship.ts';

function setupTest() {
  const commands: string[][] = [];
  const errors: string[] = [];

  return {
    commands,
    errors,
    dispatch: (releaseOutputsText: string) =>
      dispatchShip({
        releaseOutputsText,
        repository: 'acme/notes',
        runCommand: (argv) => {
          commands.push([...argv]);

          return Promise.resolve(0);
        },
        writeError: (text) => {
          errors.push(text);
        },
      }),
  };
}

test('it starts main.yml at the release tag', async () => {
  const ctx = setupTest();

  const code = await ctx.dispatch(
    JSON.stringify({
      paths_released: '["packages/cli"]',
      'packages/cli--tag_name': '@acme/cli@0.2.0',
    }),
  );

  expect({ code, commands: ctx.commands }).toStrictEqual({
    code: 0,
    commands: [
      ['gh', 'workflow', 'run', 'main.yml', '--repo', 'acme/notes', '--ref', '@acme/cli@0.2.0'],
    ],
  });
});

test('it fails and starts nothing when the release names no tag', async () => {
  const ctx = setupTest();

  const code = await ctx.dispatch(JSON.stringify({ paths_released: ['packages/cli'] }));

  expect({ code, commands: ctx.commands, errors: ctx.errors }).toStrictEqual({
    code: 1,
    commands: [],
    errors: ['::error::no tag for the released package packages/cli\n'],
  });
});

test('it fails and starts nothing when the release holds two packages', async () => {
  const ctx = setupTest();

  const code = await ctx.dispatch(
    JSON.stringify({ paths_released: ['packages/cli', 'packages/core'] }),
  );

  expect({ code, commands: ctx.commands, errors: ctx.errors }).toStrictEqual({
    code: 1,
    commands: [],
    errors: ['::error::expected one released package, got: ["packages/cli","packages/core"]\n'],
  });
});
