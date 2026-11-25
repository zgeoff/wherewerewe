import type { FilePlan } from '../install/types.ts';

// A plan that replaces a file's text with `text`, and says nothing of what it did.
export function buildTextPlan(text: string): FilePlan {
  return { kind: 'text', text, notices: [], changedLine: '', sameLine: '' };
}
