// A path as a person would type it: `~` for the home folder, and `~/…` under it.
export function formatDisplayPath(path: string, home: string): string {
  if (path === home) {
    return '~';
  }

  return path.startsWith(`${home}/`) ? `~${path.slice(home.length)}` : path;
}
