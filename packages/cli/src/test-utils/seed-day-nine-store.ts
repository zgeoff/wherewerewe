import { seedDayNineRows } from './seed-day-nine-rows.ts';
import type { DayNineStore } from './seed-day-nine-rows.ts';

// The session of brief.md's day 9, as the brief prints it.
export function seedDayNineStore(root: string): Promise<DayNineStore> {
  return seedDayNineRows(root, false);
}
