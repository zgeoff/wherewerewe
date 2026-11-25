import { expect, test } from 'bun:test';
import { pickUpgradeRun } from './pick-upgrade-run.ts';

function setupTest() {
  const installScript = [
    'curl',
    '-fsSL',
    'https://raw.githubusercontent.com/zgeoff/wherewerewe/main/install.sh',
  ];

  return {
    pickUpgradeRun,
    brewLine: { shell: ['brew', 'upgrade', 'wherewerewe'] },
    scriptLine: { pipeline: [installScript, ['sh']] },
    folderLine: (folder: string) => ({
      pipeline: [installScript, ['env', `WHEREWEREWE_INSTALL_DIR=${folder}`, 'sh']],
    }),
  };
}

test.each([
  {
    title: 'a macOS link that resolves into the Cellar',
    execPath: '/opt/homebrew/bin/wherewerewe',
    realPath: '/opt/homebrew/Cellar/wherewerewe/0.2.0/bin/wherewerewe',
  },
  {
    title: 'a Linux link that resolves into the Cellar',
    execPath: '/home/linuxbrew/.linuxbrew/bin/www',
    realPath: '/home/linuxbrew/.linuxbrew/Cellar/wherewerewe/0.2.0/bin/wherewerewe',
  },
  {
    title: 'a path in the Cellar that no link points at',
    execPath: '/usr/local/Cellar/wherewerewe/0.2.0/bin/wherewerewe',
    realPath: '/usr/local/Cellar/wherewerewe/0.2.0/bin/wherewerewe',
  },
])('#pickUpgradeRun picks brew for $title', (row) => {
  const ctx = setupTest();

  expect(ctx.pickUpgradeRun(row.execPath, row.realPath, '/Users/river')).toStrictEqual(
    ctx.brewLine,
  );
});

test.each([
  {
    title: "the install script's default folder",
    execPath: '/Users/river/.local/bin/wherewerewe',
    realPath: '/Users/river/.local/bin/wherewerewe',
  },
  {
    title: "Bun's own path, as a development run has it",
    execPath: '/usr/local/bin/bun',
    realPath: '/usr/local/bin/bun',
  },
  {
    title: 'another Cellar formula of a similar name',
    execPath: '/opt/homebrew/Cellar/wherewerewe-extras/1.0.0/bin/tool',
    realPath: '/opt/homebrew/Cellar/wherewerewe-extras/1.0.0/bin/tool',
  },
  { title: 'no path at all', execPath: '', realPath: '' },
])('#pickUpgradeRun picks the install script with no folder for $title', (row) => {
  const ctx = setupTest();

  expect(ctx.pickUpgradeRun(row.execPath, row.realPath, '/Users/river')).toStrictEqual(
    ctx.scriptLine,
  );
});

test.each([
  {
    title: 'a folder set with WHEREWEREWE_INSTALL_DIR',
    execPath: '/srv/tools/bin/wherewerewe',
    realPath: '/srv/tools/bin/wherewerewe',
    folder: '/srv/tools/bin',
  },
  {
    title: 'a www link in that folder',
    execPath: '/srv/tools/bin/www',
    realPath: '/srv/tools/bin/wherewerewe',
    folder: '/srv/tools/bin',
  },
])('#pickUpgradeRun picks the install script for the folder of $title', (row) => {
  const ctx = setupTest();

  expect(ctx.pickUpgradeRun(row.execPath, row.realPath, '/Users/river')).toStrictEqual(
    ctx.folderLine(row.folder),
  );
});
