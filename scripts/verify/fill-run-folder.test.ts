import { expect, test } from 'bun:test';
import { fillRunFolder } from './fill-run-folder.ts';

test('it replaces each {run} with the state folder, and leaves a text without one as it is', () => {
  expect([
    fillRunFolder('www where wt-a "tree" --path {run}/paths/a --path {run}/paths/b', '/runs/r-1'),
    fillRunFolder('www task t-a "Write it"', '/runs/r-1'),
  ]).toStrictEqual([
    'www where wt-a "tree" --path /runs/r-1/paths/a --path /runs/r-1/paths/b',
    'www task t-a "Write it"',
  ]);
});
