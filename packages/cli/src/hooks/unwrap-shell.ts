// `<shell> -lc '<command>'` or `<shell> -c '<command>'`, where the shell is bash, sh or zsh by name
// or as an absolute path and the command is one single-quoted word, gives the inner command. Any
// other text comes back as it is.
export function unwrapShell(command: string): string {
  const inner = /^(?:\/(?:[^/\s']+\/)*)?(?:bash|sh|zsh) -(?:lc|c) '(?<inner>[^']*)'$/u.exec(command)
    ?.groups?.['inner'];

  return inner ?? command;
}
