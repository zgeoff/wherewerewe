import { expect, test } from 'bun:test';
import { listCommandShapes } from '../args/parse-cli-args.ts';
import { listKinds } from '../rules/list-kinds.ts';
import { buildPrintSites } from './build-print-sites.ts';

function setupTest() {
  return { build: () => buildPrintSites(['l-1', 'd-1']) };
}

test('it builds a site for every command that reads a store, every list kind, and every id of each command that takes one', () => {
  const ctx = setupTest();
  const titles = ctx.build().map((site) => site.title);

  expect({
    commands: [...new Set(ctx.build().map((site) => site.argv[0] ?? 'brief'))].toSorted(),
    lists: titles.filter((title) => title.startsWith('www list ')),
    shows: titles.filter((title) => title.startsWith('www show')),
    drops: titles.filter((title) => title.startsWith('www drop')),
  }).toStrictEqual({
    commands: listCommandShapes()
      .map((shape) => shape.command)
      .filter((command) => !['install', 'doctor', 'hook'].includes(command))
      .toSorted(),
    lists: listKinds.map((kind) => `www list ${kind}`),
    shows: ['www show', 'www show l-1', 'www show d-1'],
    drops: ['www drop l-1 --why not needed now', 'www drop d-1 --why not needed now'],
  });
});
