// The text of a journey line with each `{run}` replaced by the run's state folder, so a line can
// name a path inside the run, such as one that `www make-path` made.
export function fillRunFolder(text: string, stateRoot: string): string {
  return text.replaceAll('{run}', stateRoot);
}
