import { expect, test } from 'bun:test';
import { readHelpCommandLine } from './read-help-command-line.ts';

function setupTest() {
  return {
    helpText: [
      'Read.',
      '  www                        the brief: goal, grant,',
      '  www show [<id>]            one item (www show grant): its text',
      '                             its check now',
      '  www log [--since <t>]',
      '                             the journal',
      'Write.',
      '  www wait <id> "<what>" --who <who> [<check>]',
      '  www grant [--may "<words>"]',
      '            --where <where> --reading "<what>"',
      '  www grant --reading "<what>"',
      'Session: www init <name> --goal "<goal>"   www attach <name>   www detach',
      '',
    ].join('\n'),
  };
}

test.each([
  ['wait', 'wait <id> "<what>" --who <who> [<check>]'],
  ['show', 'show [<id>]'],
  ['log', 'log [--since <t>]'],
  ['grant', 'grant [--may "<words>"] --where <where> --reading "<what>"'],
  ['init', 'init <name> --goal "<goal>"'],
  ['attach', 'attach <name>'],
  ['detach', 'detach'],
  ['sessions', null],
])('it reads the help line of %s as %p', (command, expected) => {
  const ctx = setupTest();

  expect(readHelpCommandLine(ctx.helpText, command)).toBe(expected);
});
