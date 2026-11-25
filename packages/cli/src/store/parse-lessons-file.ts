import { findTextProblem } from '../rules/find-text-problem.ts';
import { isItemID } from '../rules/is-item-id.ts';
import { isUTCTime } from '../rules/is-utc-time.ts';
import { textLimits } from '../rules/text-limits.ts';
import type { LessonRow } from '../types.ts';
import { lessonsHeader } from './constants.ts';
import { parseRowsFile } from './parse-rows-file.ts';
import type { RowsParse } from './parse-rows-file.ts';

export function parseLessonsFile(text: string): RowsParse<LessonRow> {
  return parseRowsFile(text, lessonsHeader, parseLessonLine);
}

function parseLessonLine(cells: readonly string[]): LessonRow | string {
  const [id = '', lessonText = '', why = '', written = '', by = ''] = cells;

  if (!isItemID(id)) {
    return 'the id is not an item id';
  }

  if (findTextProblem(lessonText, textLimits.lesson) !== null) {
    return 'the text is empty, longer than 120 characters or not one line';
  }

  if (findTextProblem(why, textLimits.lessonWhy) !== null) {
    return 'the why is empty, longer than 200 characters or not one line';
  }

  if (!isUTCTime(written)) {
    return 'the written time is not an ISO 8601 UTC time to the second, ending in Z';
  }

  if (by !== 'agent' && by !== 'owner') {
    return 'the by column is not agent or owner';
  }

  return { id, text: lessonText, why, written, by };
}
