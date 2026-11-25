import { expect, test } from 'bun:test';
import { buildFormula } from './build-formula.ts';
import { findFormulaVersion } from './find-formula-version.ts';

function setupTest() {
  const checksums = ['darwin-arm64', 'darwin-x64', 'linux-arm64', 'linux-x64']
    .map((target) => `${'a'.repeat(64)}  wherewerewe-${target}\n`)
    .join('');

  return {
    findFormulaVersion,
    buildFormula: (version: string) => buildFormula({ version, tag: `tag-${version}`, checksums }),
  };
}

test('it finds the version of a formula that buildFormula wrote', () => {
  const ctx = setupTest();

  expect(ctx.findFormulaVersion(ctx.buildFormula('0.3.1'))).toBe('0.3.1');
});

test('it finds no version in a text that declares none', () => {
  const ctx = setupTest();

  expect(ctx.findFormulaVersion('class Wherewerewe < Formula\nend\n')).toBeNull();
});
