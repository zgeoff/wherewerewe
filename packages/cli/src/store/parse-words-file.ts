import { findTextProblem } from '../rules/find-text-problem.ts';
import { isItemID } from '../rules/is-item-id.ts';
import { isUTCTime } from '../rules/is-utc-time.ts';
import { textLimits } from '../rules/text-limits.ts';
import type { WordsRow } from '../types.ts';
import { wordsHeader } from './constants.ts';
import { parseRowsFile } from './parse-rows-file.ts';
import type { RowsParse } from './parse-rows-file.ts';

export function parseWordsFile(text: string): RowsParse<WordsRow> {
  return parseRowsFile(text, wordsHeader, parseWordsLine);
}

function parseWordsLine(cells: readonly string[]): WordsRow | string {
  const [id = '', words = '', where = '', written = '', by = ''] = cells;

  if (!isItemID(id)) {
    return 'the id is not an item id';
  }

  if (findTextProblem(words, textLimits.words) !== null) {
    return 'the words are empty, longer than 300 characters or not one line';
  }

  if (findTextProblem(where, textLimits.wordsWhere) !== null || /[;=]/u.test(where)) {
    return 'the where is empty, longer than 16 characters, not one line or holds ; or =';
  }

  if (!isUTCTime(written)) {
    return 'the written time is not an ISO 8601 UTC time to the second, ending in Z';
  }

  if (by !== 'agent' && by !== 'owner') {
    return 'the by column is not agent or owner';
  }

  return { id, words, where, written, by };
}
