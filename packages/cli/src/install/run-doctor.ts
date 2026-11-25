import type { Context, Reply } from '../types.ts';
import { buildReply } from './build-reply.ts';
import { checkStore } from './check-store.ts';
import { readPlan } from './read-plan.ts';

export interface DoctorOutcome {
  readonly reply: Reply;
  readonly exitCode: number;
}

// Checks the setup and changes nothing. The exit code is 3 when something needs a fix.
export async function runDoctor(context: Context): Promise<DoctorOutcome> {
  const plan = await readPlan(context);
  const checks = await checkStore(context);

  const steps = [...plan, ...checks];

  const fixed = steps.map((step) =>
    step.ok || step.content === undefined
      ? step
      : { ...step, detail: `${step.detail}. Run: www install` },
  );

  return { reply: buildReply(fixed), exitCode: steps.every((step) => step.ok) ? 0 : 3 };
}
