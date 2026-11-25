import { expect, test } from 'bun:test';
import { pickHostTarget } from './pick-host-target.ts';

function setupTest() {
  return { pickHostTarget };
}

test.each([
  ['darwin', 'arm64', 'darwin-arm64'],
  ['darwin', 'x64', 'darwin-x64'],
  ['linux', 'x64', 'linux-x64'],
  ['linux', 'arm64', 'linux-arm64'],
  ['win32', 'x64', null],
  ['linux', 'riscv64', null],
])('it maps %s on %s to %s', (platform, arch, target) => {
  const ctx = setupTest();

  expect(String(ctx.pickHostTarget(platform, arch))).toBe(String(target));
});
