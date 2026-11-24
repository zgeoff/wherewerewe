import { toPlaceholder } from './to-placeholder.ts';

// The placeholders of a Run line that asks for the grant's texts, which only the owner's words and
// the agent's reading can fill. Each bullet placeholder says what the owner said in that group.
export const grantPlaceholders = {
  may: toPlaceholder('<what the owner allows, in their words>'),
  not: toPlaceholder('<what the owner did not grant, in their words>'),
  never: toPlaceholder('<what the owner ruled out, in their words>'),
  reading: toPlaceholder('<what they cover; what the owner kept back>'),
} as const;
