import type { Item } from '../types.ts';
import { seedItems } from './seed-items.ts';

// Adds one open item to a session folder through the store module. The fields the test leaves out
// read as an unchecked task written on 2026-03-10.
export async function seedItem(
  folder: string,
  fields: Partial<Item> & { id: string },
): Promise<void> {
  await seedItems(folder, [fields]);
}
