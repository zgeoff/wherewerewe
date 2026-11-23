#!/usr/bin/env bun

const helpText = `wherewerewe (www): notes for one long agent session

Usage:
  www help      print this help
  www --help    print this help
`;

const [command] = process.argv.slice(2);

if (command === undefined || command === 'help' || command === '--help') {
  process.stdout.write(helpText);
} else {
  process.stderr.write(`www: unknown command '${command}'\n\n${helpText}`);

  process.exitCode = 1;
}
