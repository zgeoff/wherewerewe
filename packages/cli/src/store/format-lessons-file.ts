import type { LessonRow } from '../types.ts';
import { lessonsHeader } from './constants.ts';

export function formatLessonsFile(lessons: readonly LessonRow[]): string {
  const rows = lessons.map((lesson) =>
    [lesson.id, lesson.text, lesson.why, lesson.written, lesson.by].join('\t'),
  );

  return `${[lessonsHeader, ...rows].join('\n')}\n`;
}
