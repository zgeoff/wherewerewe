// The limits of a read's probes, from checks.md. A branch's limit covers both of its commands.
export const checkLimits = {
  // the read stops waiting for its probes at this time
  deadlineMs: 5000,
  maxParallelProbes: 8,
  probeTimeoutMs: { pr: 4000, branch: 2000, path: 2000 },
} as const;
