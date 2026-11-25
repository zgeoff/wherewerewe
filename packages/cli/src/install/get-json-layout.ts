import type { JSONNode } from './parse-json-spans.ts';

export interface JSONLayout {
  // whether the container's text spans more than one line, or is empty, so an insert takes lines
  readonly isMultiline: boolean;
  readonly itemIndent: string;
  readonly closeIndent: string;
  readonly unit: string;
}

// How the text lays out a container: the indent of its items and of its closing bracket, and the
// indent unit of the file, so an insert looks like what the user wrote.
export function getJSONLayout(
  text: string,
  container: JSONNode,
  firstItemStart: number | null,
): JSONLayout {
  const unit = getUnit(text);
  const isEmpty = firstItemStart === null;
  const isMultiline = isEmpty || text.slice(container.start, container.end).includes('\n');
  const openIndent = lineIndent(text, container.start);
  const closeIndent = isEmpty ? openIndent : lineIndent(text, container.end - 1);
  const itemIndent = isEmpty ? `${openIndent}${unit}` : lineIndent(text, firstItemStart);

  return { isMultiline, itemIndent, closeIndent, unit };
}

function getUnit(text: string): string {
  const indented = /\n(?<indent>[ \t]+)\S/u.exec(text)?.groups?.['indent'];

  return indented ?? '  ';
}

// The leading white space of the line that holds the offset.
function lineIndent(text: string, offset: number): string {
  const lineStart = text.lastIndexOf('\n', offset - 1) + 1;

  return /^[ \t]*/u.exec(text.slice(lineStart))?.[0] ?? '';
}
