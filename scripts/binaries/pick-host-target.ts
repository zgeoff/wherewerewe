import { allTargets } from './all-targets.ts';

// The release target of a machine, or null for a platform that has no binary.
export function pickHostTarget(platform: string, arch: string): (typeof allTargets)[number] | null {
  const target = `${platform}-${arch}`;

  return allTargets.find((candidate) => candidate === target) ?? null;
}
