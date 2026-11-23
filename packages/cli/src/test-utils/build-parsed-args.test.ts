import { expect, test } from 'bun:test';
import { buildParsedArgs } from './build-parsed-args.ts';

test('it builds the arguments of an argv that parses', () => {
  const args = buildParsedArgs(['show', 't-a']);

  expect({ command: args.command, positionals: args.positionals }).toStrictEqual({
    command: 'show',
    positionals: ['t-a'],
  });
});

test('it throws on an argv that the parser refuses', () => {
  expect(() => buildParsedArgs(['taks'])).toThrow('the argv is refused: unknown-command');
});
