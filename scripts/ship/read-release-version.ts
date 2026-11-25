import { join } from 'node:path';
import { z } from 'zod';

const manifestSchema = z.object({ version: z.string().min(1) });

// The version in the package's manifest, which release-please bumps.
export async function readReleaseVersion(root: string): Promise<string> {
  const manifestJSON: unknown = await Bun.file(
    join(root, 'packages', 'cli', 'package.json'),
  ).json();

  return manifestSchema.parse(manifestJSON).version;
}
