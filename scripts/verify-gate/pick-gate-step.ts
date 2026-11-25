import { z } from 'zod';

// release-please opens its release pull request from this branch, as main.yml configures it.
const releaseBranch = 'release-please--branches--main--components--@wherewerewe/cli';
const releaseLogin = 'zgeoff-release-please[bot]';
const renovateLogin = 'zgeoff-renovate[bot]';
const repoSchema = z.object({ full_name: z.string().min(1) }).nullable();
const refSchema = z.object({ ref: z.string().min(1), repo: repoSchema });
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

// Picks what the `verify / gate` job does for a pull_request event. A release-please or Renovate bot's
// pull request from this repo changes only versions, and nobody runs a journey on it, so its body never holds a
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

  const isSameRepo =
    pullRequest.head.repo !== null &&
    pullRequest.base.repo !== null &&
    pullRequest.head.repo.full_name === pullRequest.base.repo.full_name;

  if (
    isBot &&
    isSameRepo &&
    pullRequest.user.login === releaseLogin &&
    pullRequest.head.ref === releaseBranch
  ) {
    return { kind: 'skip', reason: 'a release pull request carries no verify report' };
  }

  if (
    isBot &&
    isSameRepo &&
    pullRequest.user.login === renovateLogin &&
    pullRequest.head.ref.startsWith('renovate/')
  ) {
    return { kind: 'skip', reason: 'a Renovate pull request carries no verify report' };
  }

  return { kind: 'gate', baseRef: pullRequest.base.ref, body: pullRequest.body ?? '' };
}
