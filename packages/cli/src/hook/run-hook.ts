import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { readBinding } from '../store/read-binding.ts';
import { readRoot } from '../store/read-root.ts';
import type { Context, Harness } from '../types.ts';
import { isBriefCommand } from './is-brief-command.ts';
import { parsePayload } from './parse-payload.ts';
import { readGate } from './read-gate.ts';
import { writeGate } from './write-gate.ts';

// One hook call. Anything that goes wrong lets the call through: the gate fails open.
export async function runHook(context: Context, harness: Harness): Promise<string> {
  try {
    return await runGateStep(context, harness);
  } catch {
    return '';
  }
}

// After this many refusals in a row the gate opens, so a broken setup never traps a session.
const refusalLimit = 3;

async function runGateStep(context: Context, harness: Harness): Promise<string> {
  const payload = parsePayload(context.stdin);

  if (payload === null) {
    return '';
  }

  const root = readRoot(context.env);

  const name = await readBinding(root, { harness, id: payload.sessionID });

  if (name === null) {
    return '';
  }

  await mkdir(join(root, '.gate'), { recursive: true });

  const path = join(root, '.gate', `${harness}-${payload.sessionID}`);

  if (payload.event === 'SessionStart') {
    await writeGate(path, { state: 'wiped', refusals: 0 });

    return `wherewerewe: this session keeps its notes in ${name}. Run: www\n`;
  }

  if (payload.event !== 'PreToolUse' || payload.isSubagent) {
    return '';
  }

  const gate = await readGate(path);

  if (gate.state === 'read') {
    return '';
  }

  if (payload.command !== null && isBriefCommand(payload.command)) {
    await writeGate(path, { state: 'read', refusals: 0 });

    return '';
  }

  if (gate.refusals >= refusalLimit) {
    await writeGate(path, { state: 'read', refusals: 0 });

    return JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        additionalContext: `wherewerewe: ${name}'s brief was never read, so your calls go through until the next compaction. Run: www`,
      },
    });
  }

  await writeGate(path, { state: 'wiped', refusals: gate.refusals + 1 });

  return JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: formatReason(name, harness),
    },
  });
}

function formatReason(name: string, harness: Harness): string {
  const hint =
    harness === 'codex' ? '   (pass max_output_tokens 10000, so the whole brief reaches you)' : '';

  return `wherewerewe: this session started or was compacted, and ${name}'s brief is not in your context yet.\nRun: www${hint}`;
}
