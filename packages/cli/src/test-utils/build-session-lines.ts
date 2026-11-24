// The lines of a format 2 session file before its grant keys, for a test that adds the rest.
export function buildSessionLines(): string[] {
  return [
    'format=2',
    'name=tide-alerts',
    'goal=Ship it',
    'started=2026-03-02T08:04:11Z',
    'now=t-a',
    'now_next=go',
    'now_set=2026-03-10T10:31:09Z',
    'last_write=2026-03-10T11:02:40Z',
    'last_nudge=',
  ];
}
