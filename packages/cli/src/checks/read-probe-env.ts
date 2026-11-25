import { realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';

// The variables a probe's git and gh take from the caller. Any other, such as GIT_CONFIG_PARAMETERS,
// GIT_DIR, LD_PRELOAD or GH_FORCE_TTY, could make git or gh read other config or start a program.
const passedNames: ReadonlySet<string> = new Set([
  'HOME',
  'USER',
  'XDG_CONFIG_HOME',
  'GIT_CONFIG_GLOBAL',
  'GIT_CONFIG_SYSTEM',
  'GIT_CONFIG_NOSYSTEM',
  'GH_TOKEN',
  'GITHUB_TOKEN',
  'GH_ENTERPRISE_TOKEN',
  'GITHUB_ENTERPRISE_TOKEN',
  'GH_HOST',
  'GH_CONFIG_DIR',
  'HTTPS_PROXY',
  'https_proxy',
  'HTTP_PROXY',
  'http_proxy',
  'NO_PROXY',
  'no_proxy',
  'SSL_CERT_FILE',
  'SSL_CERT_DIR',
]);

// Variables that name a config file for git: one that names a file in the folder the command runs
// in is an agent's file, so git gets /dev/null, an empty config, in its place.
const configFileNames: ReadonlySet<string> = new Set(['GIT_CONFIG_GLOBAL', 'GIT_CONFIG_SYSTEM']);

// The env of a probe's command: the passed variables, the PATH the probe searched, and settings
// that keep git and gh from prompting, fetching or reading a translated message.
export function readProbeEnv(
  env: Readonly<Record<string, string | undefined>>,
  path: string,
  cwd: string,
): Record<string, string> {
  const passed = Object.entries(env).flatMap(([name, value]) => {
    if (!passedNames.has(name) || value === undefined) {
      return [];
    }

    return [[name, configFileNames.has(name) && readIsInFolder(value, cwd) ? '/dev/null' : value]];
  });

  return {
    ...Object.fromEntries(passed),
    PATH: path,
    GH_PROMPT_DISABLED: '1',
    GIT_TERMINAL_PROMPT: '0',
    GIT_ALLOW_PROTOCOL: 'none',
    GIT_NO_LAZY_FETCH: '1',
    LC_ALL: 'C',
  };
}

function readIsInFolder(file: string, cwd: string): boolean {
  const fromFolder = relative(readRealPath(cwd), readRealPath(resolve(cwd, file)));

  return (
    fromFolder === '' ||
    (fromFolder !== '..' && !fromFolder.startsWith('../') && !isAbsolute(fromFolder))
  );
}

// A file that does not exist yet keeps its lexical form: its folder is what matters.
function readRealPath(path: string): string {
  try {
    return realpathSync(path);
  } catch {
    return resolve(path);
  }
}
