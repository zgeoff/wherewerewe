import { buildMockIDs } from './build-mock-ids.ts';
import { seedItems } from './seed-items.ts';

// Adds open tasks t-01, t-02 and on, through the store module, in one write.
export async function seedTasks(folder: string, count: number): Promise<void> {
  await seedItems(
    folder,
    buildMockIDs('t-', count).map((id) => ({ id, claim: `Task ${id}` })),
  );
}
