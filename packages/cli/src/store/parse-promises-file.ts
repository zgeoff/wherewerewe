import { findTextProblem } from '../rules/find-text-problem.ts';
import { isItemID } from '../rules/is-item-id.ts';
import { isUTCTime } from '../rules/is-utc-time.ts';
import { textLimits } from '../rules/text-limits.ts';
import type { PromiseRow } from '../types.ts';
import { promisesHeader } from './constants.ts';
import { parseRowsFile } from './parse-rows-file.ts';
import type { RowsParse } from './parse-rows-file.ts';

export function parsePromisesFile(text: string): RowsParse<PromiseRow> {
  return parseRowsFile(text, promisesHeader, parsePromiseLine);
}

function parsePromiseLine(cells: readonly string[]): PromiseRow | string {
  const [id = '', what = '', to = '', byWhen = '', written = '', by = ''] = cells;

  if (!isItemID(id)) {
    return 'the id is not an item id';
  }

  if (findTextProblem(what, textLimits.promise) !== null) {
    return 'the what is empty, longer than 120 characters or not one line';
  }

  if (findTextProblem(to, textLimits.promiseTo) !== null || /[;=]/u.test(to)) {
    return 'the to is empty, longer than 16 characters, not one line or holds ; or =';
  }

  if (findTextProblem(byWhen, textLimits.promiseBy) !== null || /[;=]/u.test(byWhen)) {
    return 'the by_when is empty, longer than 24 characters, not one line or holds ; or =';
  }

  if (!isUTCTime(written)) {
    return 'the written time is not an ISO 8601 UTC time to the second, ending in Z';
  }

  if (by !== 'agent' && by !== 'owner') {
    return 'the by column is not agent or owner';
  }

  return { id, what, to, byWhen, written, by };
}
