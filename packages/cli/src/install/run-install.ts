import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Context, Reply } from '../types.ts';
import { buildReply } from './build-reply.ts';
import { checkStore } from './check-store.ts';
import { readPlan } from './read-plan.ts';
import type { Step } from './types.ts';

// Writes the hook entries, the allow rules and the skill. A file it changes is backed up first.
export async function runInstall(context: Context, isPrinting: boolean): Promise<Reply> {
  const steps = await readPlan(context);

  if (isPrinting) {
    return buildReply(
      steps.map((step) =>
        step.content === undefined ? step : { ...step, detail: `would write: ${step.detail}` },
      ),
    );
  }

  const done: Step[] = [];

  for (const step of steps) {
    if (step.content === undefined) {
      done.push(step);
    } else {
      await mkdir(dirname(step.path), { recursive: true });
      await copyFile(step.path, `${step.path}.www-backup`).catch(() => null);
      await writeFile(step.path, step.content);

      done.push({ path: step.path, ok: true, detail: 'written' });
    }
  }

  const checks = await checkStore(context);

  return buildReply([...done, ...checks]);
}
