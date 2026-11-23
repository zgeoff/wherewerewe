import { z } from 'zod';

// release-please opens its release pull request from this branch, as main.yml configures it.
const releaseBranch = 'release-please--branches--main';
const renovateLogin = 'zgeoff-renovate[bot]';
const refSchema = z.object({ ref: z.string().min(1) });
const userSchema = z.object({ type: z.string(), login: z.string() });

const pullRequestSchema = z.object({
  body: z.string().nullable(),
  base: refSchema,
  head: refSchema,
  user: userSchema,
});

const pullRequestEventSchema = z.object({ pull_request: pullRequestSchema });

export type GateStep =
  | { readonly kind: 'skip'; readonly reason: string }
  | { readonly kind: 'gate'; readonly baseRef: string; readonly body: string }
  | { readonly kind: 'refused'; readonly message: string };

// Picks what the `verify / gate` job does for a pull_request event. A bot's release or Renovate
// pull request changes only versions, and nobody runs a journey on it, so its body never holds a
// report: the job passes it. A person's branch of the same name still meets the gate.
export function pickGateStep(event: unknown): GateStep {
  const parsed = pullRequestEventSchema.safeParse(event);

  if (!parsed.success) {
    return {
      kind: 'refused',
      message: 'the event holds no pull request; run this on pull_request',
    };
  }

  const pullRequest = parsed.data.pull_request;
  const isBot = pullRequest.user.type === 'Bot';

  if (isBot && pullRequest.head.ref === releaseBranch) {
    return { kind: 'skip', reason: 'a release pull request carries no verify report' };
  }

  if (
    isBot &&
    pullRequest.user.login === renovateLogin &&
    pullRequest.head.ref.startsWith('renovate/')
  ) {
    return { kind: 'skip', reason: 'a Renovate pull request carries no verify report' };
  }

  return { kind: 'gate', baseRef: pullRequest.base.ref, body: pullRequest.body ?? '' };
}
