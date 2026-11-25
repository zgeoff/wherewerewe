import { basename, dirname, join } from 'node:path';
import type { UpgradeRun } from '../types.ts';

const cellarFolder = '/Cellar/wherewerewe/';
const installScriptURL = 'https://raw.githubusercontent.com/zgeoff/wherewerewe/main/install.sh';

// Only brew keeps Homebrew's own record right, so a path through its Cellar gets brew. Any other
// path gets the install script, which names the binary's folder when it is not the default one.
export function pickUpgradeRun(execPath: string, realPath: string, homeDir: string): UpgradeRun {
  if (execPath.includes(cellarFolder) || realPath.includes(cellarFolder)) {
    return { shell: ['brew', 'upgrade', 'wherewerewe'] };
  }

  const folder = dirname(realPath);

  const isCustomFolder =
    basename(realPath) === 'wherewerewe' && folder !== join(homeDir, '.local', 'bin');

  return {
    pipeline: [
      ['curl', '-fsSL', installScriptURL],
      isCustomFolder ? ['env', `WHEREWEREWE_INSTALL_DIR=${folder}`, 'sh'] : ['sh'],
    ],
  };
}
