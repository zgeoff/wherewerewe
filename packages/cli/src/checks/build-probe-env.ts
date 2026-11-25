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

// The env of a probe's command: the passed variables, the PATH the probe searched, and settings
// that keep git and gh from prompting, fetching or reading a translated message.
export function buildProbeEnv(
  env: Readonly<Record<string, string | undefined>>,
  path: string,
): Record<string, string> {
  const passed = Object.entries(env).flatMap(([name, value]) =>
    passedNames.has(name) && value !== undefined ? [[name, value] as const] : [],
  );

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
