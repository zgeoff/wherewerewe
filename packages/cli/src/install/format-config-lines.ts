// The lines that Codex's `config.toml` needs, which install prints and never writes: hooks on, and
// the store root writable from the sandbox.
export function formatConfigLines(shownConfig: string, storeRoot: string): string {
  return [
    `www install: add these lines to ${shownConfig}; install never edits that file:`,
    '[features]',
    'hooks = true',
    '',
    '[sandbox_workspace_write]',
    `writable_roots = [${JSON.stringify(storeRoot)}]`,
    '',
  ].join('\n');
}
