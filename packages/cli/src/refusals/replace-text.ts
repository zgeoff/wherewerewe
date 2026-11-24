import type { ParsedArgs, TextTarget } from '../types.ts';
import { buildRunSpec } from './build-run-spec.ts';
import type { RunSpec } from './build-run-spec.ts';

// The refused command with the text at the target replaced, so its Run line keeps every other flag.
export function replaceText(args: ParsedArgs, target: TextTarget, value: string): string[] {
  const spec: RunSpec = buildRunSpec(args);
  const place = target.place;

  if ('positional' in place) {
    return spec.replacePositional(place.positional, value).toArgv();
  }

  return 'occurrence' in place
    ? spec.replaceFlagAt(place.flag, place.occurrence, value).toArgv()
    : spec.replaceFlag(place.flag, value).toArgv();
}
