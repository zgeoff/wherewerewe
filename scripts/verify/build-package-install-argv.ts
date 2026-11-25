import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// The argv that runs install.sh with the run's release folder as its download and the run's bin
// folder as its install folder, and HOME inside the run, so the script reaches no network and no
// folder of the owner's. The file URL percent-encodes the folder, which curl needs for a space.
export function buildPackageInstallArgv(
  stateRoot: string,
  installScript: string,
): readonly string[] {
  return [
    'env',
    `HOME=${join(stateRoot, 'home')}`,
    `WHEREWEREWE_RELEASE_URL=${pathToFileURL(join(stateRoot, 'release')).href}`,
    `WHEREWEREWE_INSTALL_DIR=${join(stateRoot, 'bin')}`,
    'sh',
    installScript,
  ];
}
