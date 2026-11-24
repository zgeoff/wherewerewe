// The lines of one section of the brief or the recap: the line that starts with the heading, then
// each line after it that starts with a space. A heading the text lacks gives no line.
export function collectBriefSection(text: string, heading: string): string[] {
  const lines = text.split('\n');
  const start = lines.findIndex((line) => line.startsWith(heading));

  if (start === -1) {
    return [];
  }

  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => !line.startsWith(' '));

  return [lines[start] ?? '', ...(end === -1 ? rest : rest.slice(0, end))];
}
