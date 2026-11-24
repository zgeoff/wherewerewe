import type { RunSpec } from './build-run-spec.ts';
import { grantPlaceholders } from './grant-placeholders.ts';

// Adds each of --may, --where and --reading that the command did not type, in that order. A
// missing --where reads chat, the place the owner usually gives the words.
export function addGrantFlags(spec: RunSpec, typed: ReadonlySet<string>): RunSpec {
  const withMay = typed.has('may') ? spec : spec.addFlag('may', grantPlaceholders.may);
  const withWhere = typed.has('where') ? withMay : withMay.addFlag('where', 'chat');

  return typed.has('reading') ? withWhere : withWhere.addFlag('reading', grantPlaceholders.reading);
}
