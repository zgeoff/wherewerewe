// A path as a person would type it: `~/…` when it is under the home folder.
export function formatDisplayPath(path: string, home: string): string {
  return path.startsWith(`${home}/`) ? `~${path.slice(home.length)}` : path;
}
