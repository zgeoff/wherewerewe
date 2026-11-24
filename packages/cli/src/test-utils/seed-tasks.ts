import { buildMockIDs } from './build-mock-ids.ts';
import { seedItem } from './seed-item.ts';

// Adds open tasks t-01, t-02 and on, through the store module.
export async function seedTasks(folder: string, count: number): Promise<void> {
  for (const id of buildMockIDs('t-', count)) {
    await seedItem(folder, { id, claim: `Task ${id}` });
  }
}
