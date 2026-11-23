const width = 100;
const prefix = 'GOAL  ';
const indent = '      ';

// Wraps the goal at 100 columns, greedy, at spaces. A word longer than a line is cut hard. The
// first line starts with `GOAL  `, and each further line is indented 6.
export function formatGoalLines(goal: string): string[] {
  const lines: string[] = [];
  let current = prefix;
  let isEmpty = true;

  for (const word of goal.split(' ').filter((part) => part !== '')) {
    let rest = Array.from(word, (character) => character);

    while (current.length + (isEmpty ? 0 : 1) + rest.length > width) {
      if (!isEmpty) {
        lines.push(current);

        current = indent;
        isEmpty = true;
        continue;
      }

      const take = width - current.length;

      lines.push(current + rest.slice(0, take).join(''));

      rest = rest.slice(take);
      current = indent;
    }

    current += (isEmpty ? '' : ' ') + rest.join('');
    isEmpty = false;
  }

  lines.push(current);

  return lines;
}
