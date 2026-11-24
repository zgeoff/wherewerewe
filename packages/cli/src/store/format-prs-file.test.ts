import { expect, test } from 'bun:test';
import { formatPrsFile } from './format-prs-file.ts';

test('it writes the header, then a row for each pull request with a dash for a state not read yet', () => {
  expect(
    formatPrsFile([
      {
        ref: 'bosunhq/bosun-app#64',
        opened: '2026-03-10T08:41:30Z',
        state: 'OPEN',
        seen: '2026-03-10T11:43:04Z',
      },
      { ref: 'tidal-org/tidekit#19', opened: '2026-03-10T09:00:00Z', state: null, seen: null },
    ]),
  ).toBe(
    [
      'ref\topened\tstate\tseen',
      'bosunhq/bosun-app#64\t2026-03-10T08:41:30Z\tOPEN\t2026-03-10T11:43:04Z',
      'tidal-org/tidekit#19\t2026-03-10T09:00:00Z\t-\t-',
      '',
    ].join('\n'),
  );
});
