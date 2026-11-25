import { expect, test } from 'bun:test';
import { isOurHandler } from './is-our-handler.ts';

test.each([
  { command: 'wherewerewe hook claude', expected: true },
  { command: '/usr/local/bin/wherewerewe hook claude', expected: true },
  { command: "'/opt/my tools/wherewerewe' hook claude", expected: true },
  { command: '"/opt/my tools/wherewerewe" hook claude', expected: true },
  { command: 'bun /opt/cli/wherewerewe hook claude', expected: true },
  { command: '/usr/bin/elsewherewerewe hook claude', expected: false },
  { command: "'/opt/elsewherewerewe' hook claude", expected: false },
  { command: '/usr/local/bin/wherewerewe hook codex', expected: false },
  { command: 'wherewerewe hook claude --debug', expected: false },
])('it finds $command ours for claude: $expected', (row) => {
  expect(isOurHandler({ type: 'command', command: row.command }, 'claude')).toBe(row.expected);
});

test.each([null, 'wherewerewe hook claude', { type: 'command' }, { command: 3 }])(
  'it finds a handler with no command text not ours: %p',
  (handler) => {
    expect(isOurHandler(handler, 'claude')).toBe(false);
  },
);
