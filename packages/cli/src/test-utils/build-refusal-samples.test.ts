import { expect, test } from 'bun:test';
import { listCommandShapes } from '../args/parse-cli-args.ts';
import { buildRefusalSamples } from './build-refusal-samples.ts';

function setupTest() {
  return { buildRefusalSamples };
}

test('it gives a wrong number of arguments and a stray flag for each command but the brief, whose stray word is an unknown command', () => {
  const ctx = setupTest();
  const samples = ctx.buildRefusalSamples();

  const commandsOf = (kind: string) =>
    samples.flatMap((sample) =>
      sample.reason.kind === kind && 'command' in sample.reason ? [sample.reason.command] : [],
    );

  const commands = listCommandShapes().map((shape) => shape.command);

  expect({
    wrongPositionals: commandsOf('wrong-positionals'),
    flagNotTaken: commandsOf('flag-not-taken'),
  }).toStrictEqual({
    wrongPositionals: commands.filter((command) => command !== 'brief'),
    flagNotTaken: commands,
  });
});

test('it gives each sample a title of its own', () => {
  const ctx = setupTest();
  const titles = ctx.buildRefusalSamples().map((sample) => sample.title);

  expect(new Set(titles).size).toBe(titles.length);
});
