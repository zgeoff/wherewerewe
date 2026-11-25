import { expect, test } from 'bun:test';
import { buildPackageInstallArgv } from './build-package-install-argv.ts';

function setupTest() {
  return { buildPackageInstallArgv };
}

test('it points install.sh at the release folder and the bin folder of the run', () => {
  const ctx = setupTest();

  expect(ctx.buildPackageInstallArgv('/runs/a', '/repo/install.sh')).toStrictEqual([
    'env',
    'HOME=/runs/a/home',
    'WHEREWEREWE_RELEASE_URL=file:///runs/a/release',
    'WHEREWEREWE_INSTALL_DIR=/runs/a/bin',
    'sh',
    '/repo/install.sh',
  ]);
});

test('it percent-encodes a run folder that holds a space, so curl reads the file URL', () => {
  const ctx = setupTest();

  expect(ctx.buildPackageInstallArgv('/work/With Space/a', '/repo/install.sh')).toStrictEqual([
    'env',
    'HOME=/work/With Space/a/home',
    'WHEREWEREWE_RELEASE_URL=file:///work/With%20Space/a/release',
    'WHEREWEREWE_INSTALL_DIR=/work/With Space/a/bin',
    'sh',
    '/repo/install.sh',
  ]);
});
