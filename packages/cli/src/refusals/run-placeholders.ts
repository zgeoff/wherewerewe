import { noSecretPlaceholder } from '../rules/redact-credential.ts';
import { toPlaceholder } from './to-placeholder.ts';

// The placeholders that more than one refusal puts in its Run line.
export const runPlaceholders = {
  evidence: toPlaceholder('<PR, commit or test run>'),
  goal: toPlaceholder('<what done means>'),
  reason: toPlaceholder('<reason>'),
  newID: toPlaceholder('<new id>'),
  name: toPlaceholder('<name>'),
  claim: toPlaceholder('<claim>'),
  what: toPlaceholder('<what you did with it>'),
  secret: toPlaceholder(noSecretPlaceholder),
} as const;
