import { seedDayNineRows } from './seed-day-nine-rows.ts';
import type { DayNineStore } from './seed-day-nine-rows.ts';

// The store the examples of commands.md start from: the day-9 store before the writes those
// examples make.
export function seedExampleStartStore(root: string): Promise<DayNineStore> {
  return seedDayNineRows(root, true);
}
