import { isRecord } from '../hooks/is-record.ts';
import type { Harness } from '../hooks/types.ts';
import { buildFailedCheck } from './build-failed-check.ts';
import type { HookEntry } from './build-hook-entries.ts';
import { buildHookGroup } from './build-hook-group.ts';
import { isOurHandler } from './is-our-handler.ts';
import { parseJSONSettings } from './parse-json-settings.ts';
import type { DoctorCheck } from './types.ts';

export interface HookEntriesInput {
  readonly harness: Harness;
  readonly shown: string;
  readonly text: string | null;

  // what install would write now; `null` when no wherewerewe is on the PATH, so only presence counts
  readonly entries: readonly HookEntry[];
  readonly bin: string | null;
}

// Checks that a hooks file holds one entry for each event, each exactly the text that install would
// write now: a changed command, matcher or timeout is reported, since Codex skips a changed hook
// until the owner trusts it again.
export function checkHookEntries(input: HookEntriesInput): DoctorCheck {
  const fixInstall = 'Run: www install';
  const read = parseJSONSettings(input.text ?? '');

  if (input.text === null) {
    return buildFailedCheck([
      `www doctor: ${input.shown} does not exist, so it holds no ${input.harness} hook entry.`,
      fixInstall,
    ]);
  }

  if (read.kind !== 'object') {
    return buildFailedCheck([
      `www doctor: ${input.shown} is not JSON settings that doctor can read.`,
      'Run: www install --print',
    ]);
  }

  const hooks = isRecord(read.value['hooks']) ? read.value['hooks'] : {};

  const problems = input.entries.flatMap((entry) =>
    describeProblem(input, hooks[entry.event], entry),
  );

  if (problems.length > 0) {
    return buildFailedCheck([...problems, fixInstall, ...trustNote(input.harness)]);
  }

  return {
    isOk: true,
    lines: [
      `ok: ${input.shown} holds the ${String(input.entries.length)} ${input.harness} hook entries`,
    ],
  };
}

function describeProblem(input: HookEntriesInput, groups: unknown, entry: HookEntry): string[] {
  const list: unknown[] = Array.isArray(groups) ? groups : [];

  const ours = list.flatMap((group) => {
    const handlers: unknown[] =
      isRecord(group) && Array.isArray(group['hooks']) ? group['hooks'] : [];

    return handlers
      .filter((handler) => isOurHandler(handler, input.harness))
      .map((handler) => ({ group, handler }));
  });

  if (ours.length === 0) {
    return [
      `www doctor: ${input.shown} has no ${entry.event} entry for wherewerewe hook ${input.harness}.`,
    ];
  }

  if (ours.length > 1) {
    return [
      `www doctor: ${input.shown} has ${String(ours.length)} ${entry.event} entries for wherewerewe hook ${input.harness}.`,
    ];
  }

  const expected = buildHookGroup(entry);

  const isSame =
    input.bin === null ||
    ours.every(
      (found) =>
        Bun.deepEquals(found.handler, expected.hooks[0]) &&
        ((isRecord(found.group) ? found.group['matcher'] : undefined) ?? null) === entry.matcher,
    );

  return isSame
    ? []
    : [
        `www doctor: the ${entry.event} entry in ${input.shown} is not the one that www install writes now.`,
      ];
}

function trustNote(harness: Harness): string[] {
  return harness === 'codex'
    ? ['Codex skips a changed hook until you trust it again in /hooks.']
    : [];
}
