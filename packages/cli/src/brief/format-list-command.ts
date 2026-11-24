// `www list <kind>`, or `www --session <name> list <kind>` when the brief ran with --session.
export function formatListCommand(kind: string, sessionFlag: string | null): string {
  return sessionFlag === null ? `www list ${kind}` : `www --session ${sessionFlag} list ${kind}`;
}
