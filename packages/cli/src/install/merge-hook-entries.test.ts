import { expect, test } from 'bun:test';
import { isRecord } from '../hooks/is-record.ts';
import { isSubsequence } from '../test-utils/is-subsequence.ts';
import { buildHookEntries } from './build-hook-entries.ts';
import { checkHookEntries } from './check-hook-entries.ts';
import { mergeHookEntries } from './merge-hook-entries.ts';
import type { HookMerge } from './merge-hook-entries.ts';

function setupTest() {
  const bin = '/opt/tools/bin/wherewerewe';

  const merge = (text: string | null, harness: 'claude' | 'codex' = 'claude'): HookMerge =>
    mergeHookEntries(text, harness, buildHookEntries(harness, bin));

  const mergedText = (text: string | null, harness: 'claude' | 'codex' = 'claude'): string => {
    const result = merge(text, harness);

    return result.kind === 'merged' ? result.text : '';
  };

  const hooksOf = (
    text: string | null,
    harness: 'claude' | 'codex' = 'claude',
  ): Record<string, unknown> => {
    const value: unknown = JSON.parse(mergedText(text, harness));
    const hooks = isRecord(value) ? value['hooks'] : undefined;

    return isRecord(hooks) ? { ...hooks } : {};
  };

  return {
    bin,
    hooksOf,
    other: '{ "type": "command", "command": "~/bin/format-on-write.sh", "timeout": 10 }',
    merge,
    mergedText,
    eventsOf: (text: string | null, harness: 'claude' | 'codex' = 'claude') =>
      Object.keys(hooksOf(text, harness)),
    stopCommands: (text: string): string[] => {
      const groups = hooksOf(text)['Stop'];

      return (
        JSON.stringify(groups)
          .match(/"command":"[^"]*"/gu)
          ?.map((found) => found.slice(11, -1)) ?? []
      );
    },
    stopOf: (text: string): unknown => hooksOf(text)['Stop'],
  };
}

test('it makes a new settings file of the six Claude Code entries for a missing file', () => {
  const ctx = setupTest();

  expect(ctx.eventsOf(null)).toStrictEqual([
    'SessionStart',
    'PreToolUse',
    'PostToolUse',
    'PostToolUseFailure',
    'SubagentStart',
    'Stop',
  ]);
});

test('it makes the five Codex entries for a blank file', () => {
  const ctx = setupTest();

  expect(ctx.eventsOf('  \n', 'codex')).toStrictEqual([
    'SessionStart',
    'PreToolUse',
    'PostToolUse',
    'SubagentStart',
    'Stop',
  ]);
});

test('it keeps every byte of a file with other keys and hooks, in any indent and key order', () => {
  const ctx = setupTest();
  const text = `{\n\t"model": "opus",\n\t"hooks": {\n\t\t"PreToolUse": [\n\t\t\t{ "matcher": "Edit", "hooks": [${ctx.other}] }\n\t\t],\n\t\t"Notification": []\n\t},\n\t"env": { "TZ": "UTC" }\n}\n`;

  expect({
    isKept: isSubsequence(text, ctx.mergedText(text)),
    events: ctx.eventsOf(text),
  }).toStrictEqual({
    isKept: true,
    events: [
      'PreToolUse',
      'Notification',
      'SessionStart',
      'PostToolUse',
      'PostToolUseFailure',
      'SubagentStart',
      'Stop',
    ],
  });
});

test('it places its entry after the user hooks of an event', () => {
  const ctx = setupTest();

  expect(ctx.stopCommands(`{"hooks":{"Stop":[{"hooks":[${ctx.other}]}]}}`)).toStrictEqual([
    '~/bin/format-on-write.sh',
    `${ctx.bin} hook claude`,
  ]);
});

test('it changes no byte on a second run', () => {
  const ctx = setupTest();
  const first = ctx.mergedText('{\n    "a": 1\n}\n');

  expect(ctx.merge(first)).toStrictEqual({
    kind: 'merged',
    text: first,
    counts: { added: 0, replaced: 0, removed: 0 },
  });
});

test('it replaces an older entry that ran bun on the bin, where it stands', () => {
  const ctx = setupTest();

  const old =
    '{ "type": "command", "command": "/people/sam/.bun/bin/bun /usr/local/bin/wherewerewe hook claude", "timeout": 3 }';

  const text = `{\n  "hooks": {\n    "Stop": [\n      {\n        "hooks": [\n          ${old}\n        ]\n      },\n      { "hooks": [${ctx.other}] }\n    ]\n  }\n}\n`;

  expect(ctx.stopCommands(text)).toStrictEqual([
    `${ctx.bin} hook claude`,
    '~/bin/format-on-write.sh',
  ]);
});

test('it replaces only the handler when one group holds ours beside another hook', () => {
  const ctx = setupTest();
  const text = `{"hooks":{"Stop":[{"hooks":[${ctx.other},{"type":"command","command":"/old/wherewerewe hook claude","timeout":9}]}]}}`;

  expect(ctx.stopOf(text)).toStrictEqual([
    {
      hooks: [
        JSON.parse(ctx.other),
        { type: 'command', command: `${ctx.bin} hook claude`, timeout: 3 },
      ],
    },
  ]);
});

test('it moves its handler out of a group whose matcher is narrower than the entry, so reinstall repairs it', () => {
  const ctx = setupTest();
  const text = `{"hooks":{"PreToolUse":[{"matcher":"Bash","hooks":[${ctx.other},{"type":"command","command":"/old/wherewerewe hook claude","timeout":3}]}]}}`;
  const first = ctx.mergedText(text);
  const groups = ctx.hooksOf(first)['PreToolUse'];

  expect({
    groups,
    isCheckOk: checkHookEntries({
      harness: 'claude',
      shown: 'settings.json',
      text: first,
      entries: buildHookEntries('claude', ctx.bin),
      bin: ctx.bin,
    }).isOk,
    isSecondRunSame: ctx.mergedText(first) === first,
  }).toStrictEqual({
    groups: [
      { matcher: 'Bash', hooks: [JSON.parse(ctx.other)] },
      { hooks: [{ type: 'command', command: `${ctx.bin} hook claude`, timeout: 3 }] },
    ],
    isCheckOk: true,
    isSecondRunSame: true,
  });
});

test('it edits the later value of a key that appears twice, the one the host reads', () => {
  const ctx = setupTest();
  const text = '{"hooks":{"Stop":[]},"hooks":{"Stop":[]}}';
  const merged = ctx.mergedText(text);

  expect(ctx.stopCommands(merged)).toStrictEqual([`${ctx.bin} hook claude`]);
});

test('it removes a second wherewerewe entry of one event and keeps one', () => {
  const ctx = setupTest();
  const ours = '{"type":"command","command":"/old/wherewerewe hook claude","timeout":3}';
  const text = `{"hooks":{"Stop":[{"hooks":[${ours}]},{"hooks":[${ctx.other}]},{"hooks":[${ours}]}]}}`;

  expect(ctx.stopCommands(text)).toStrictEqual([
    `${ctx.bin} hook claude`,
    '~/bin/format-on-write.sh',
  ]);
});

test('it leaves a Codex entry in a Claude Code file alone as another harness', () => {
  const ctx = setupTest();

  const text =
    '{"hooks":{"Stop":[{"hooks":[{"type":"command","command":"/x/wherewerewe hook codex","timeout":3}]}]}}';

  expect(ctx.stopCommands(text)).toStrictEqual([
    '/x/wherewerewe hook codex',
    `${ctx.bin} hook claude`,
  ]);
});

test.each([
  { title: 'a comment', text: '{ // note\n "a": 1 }' },
  { title: 'a trailing comma', text: '{"a": 1,}' },
  { title: 'a top level that is an array', text: '[]' },
  { title: 'a top level that is null', text: 'null' },
  { title: 'hooks that is a list', text: '{"hooks": []}' },
  { title: 'an event that is an object', text: '{"hooks": {"Stop": {}}}' },
  { title: 'a group that is a string', text: '{"hooks": {"Stop": ["x"]}}' },
  { title: 'a group whose hooks is an object', text: '{"hooks": {"Stop": [{"hooks": {}}]}}' },
  { title: 'text that is not JSON', text: 'hooks = true' },
])('it reads $title as unreadable', (row) => {
  const ctx = setupTest();

  expect(ctx.merge(row.text)).toStrictEqual({ kind: 'unreadable' });
});
